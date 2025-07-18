
import { supabase } from '@/integrations/supabase/client';
import { validateUSZipcode, isZipcodeInServiceArea } from '@/utils/zipcodeValidation';
import { performBookingHealthCheck, logHealthCheck } from '@/utils/bookingHealthCheck';

export interface EnhancedBookingData {
  customer_id: string;
  service_id: string;
  scheduled_date: string;
  scheduled_start: string;
  location_notes?: string;
  customer_zipcode?: string;
  payment_intent_id?: string;
  payment_status?: string;
  payment_amount?: number; // Add payment amount field
  payment?: {
    amount: number;
    method: string;
  };
}

export interface EnhancedBookingResult {
  booking_id: string;
  status: 'confirmed' | 'pending' | 'error';
  message: string;
  worker_assigned?: boolean;
  notifications_sent?: number;
}

export const createEnhancedBooking = async (
  bookingData: EnhancedBookingData
): Promise<EnhancedBookingResult> => {
  let transactionId: string | null = null;
  let bookingId: string | null = null;

  try {
    // Validate zipcode if provided
    if (bookingData.customer_zipcode) {
      const zipcodeValidation = await validateUSZipcode(bookingData.customer_zipcode);
      if (!zipcodeValidation) {
        return {
          booking_id: '',
          status: 'error',
          message: 'Invalid zipcode provided. Please enter a valid US zipcode.'
        };
      }
    }

    // PHASE 1: CREATE TEMPORARY BOOKING FOR PAID BOOKINGS
    if (bookingData.payment_intent_id) {
      console.log('📝 STEP 1: Creating temporary booking for payment intent:', bookingData.payment_intent_id);
      
      // Strict validation of payment data
      const paymentAmount = bookingData.payment_amount || bookingData.payment?.amount;
      
      if (!paymentAmount || paymentAmount <= 0) {
        console.error('❌ FATAL: Invalid payment amount - cannot proceed with booking:', {
          payment_amount: bookingData.payment_amount,
          paymentObjectAmount: bookingData.payment?.amount,
          finalAmount: paymentAmount
        });
        
        return {
          booking_id: '',
          status: 'error',
          message: 'Invalid payment amount. Booking cannot be created without valid payment.'
        };
      }

      // Validate payment status
      if (bookingData.payment_status !== 'authorized') {
        console.error('❌ FATAL: Payment not authorized - cannot proceed with booking:', {
          payment_status: bookingData.payment_status,
          payment_intent_id: bookingData.payment_intent_id
        });
        
        return {
          booking_id: '',
          status: 'error',
          message: 'Payment not authorized. Booking cannot be created without authorized payment.'
        };
      }

      // Create temporary booking with payment_pending status
      const tempBookingInsertData = {
        customer_id: bookingData.customer_id,
        service_id: bookingData.service_id,
        scheduled_date: bookingData.scheduled_date,
        scheduled_start: bookingData.scheduled_start,
        location_notes: bookingData.location_notes,
        status: 'payment_pending' as const,
        payment_intent_id: bookingData.payment_intent_id,
        payment_status: 'pending'
      };

      const { data: tempBooking, error: tempBookingError } = await supabase
        .from('bookings')
        .insert(tempBookingInsertData)
        .select()
        .single();

      if (tempBookingError) {
        console.error('❌ FATAL: Temporary booking creation failed:', {
          error: tempBookingError,
          payment_intent_id: bookingData.payment_intent_id
        });
        
        return {
          booking_id: '',
          status: 'error',
          message: `Booking creation failed: ${tempBookingError.message}. Please try again.`
        };
      }

      bookingId = tempBooking.id;
      console.log('✅ STEP 1 SUCCESS: Temporary booking created:', {
        bookingId,
        payment_intent_id: bookingData.payment_intent_id
      });

      // PHASE 2: CREATE TRANSACTION WITH REAL BOOKING ID
      console.log('💰 STEP 2: Creating transaction record with real booking ID');
      
      // Check if transaction already exists to prevent duplicates
      const { data: existingTransaction } = await supabase
        .from('transactions')
        .select('id')
        .eq('booking_id', bookingId)
        .eq('payment_intent_id', bookingData.payment_intent_id)
        .eq('transaction_type', 'authorization')
        .single();

      if (existingTransaction) {
        console.log('⚠️ STEP 2 SKIP: Transaction already exists for this booking/payment:', {
          existingTransactionId: existingTransaction.id,
          bookingId,
          payment_intent_id: bookingData.payment_intent_id
        });
        transactionId = existingTransaction.id;
      } else {
        const { data: transactionData, error: transactionError } = await supabase
          .from('transactions')
          .insert({
            booking_id: bookingId,
            payment_intent_id: bookingData.payment_intent_id,
            amount: paymentAmount,
            status: 'pending',
            transaction_type: 'authorization',
            payment_method: 'card',
            currency: 'USD'
          })
          .select()
          .single();

        if (transactionError) {
          console.error('❌ FATAL: Transaction creation failed - rolling back temporary booking:', {
            error: transactionError,
            bookingId,
            payment_intent_id: bookingData.payment_intent_id
          });

          // Rollback: Delete temporary booking
          await supabase.from('bookings').delete().eq('id', bookingId);
          
          return {
            booking_id: '',
            status: 'error',
            message: `Payment processing failed: ${transactionError.message}. Please try again or contact support.`
          };
        }

        transactionId = transactionData.id;
      }

      console.log('✅ STEP 2 SUCCESS: Transaction ready:', {
        transactionId,
        bookingId,
        amount: paymentAmount
      });

      // PHASE 3: UPDATE BOOKING STATUS TO AUTHORIZED
      console.log('🔄 STEP 3: Updating booking status to authorized');
      
      // Perform health check before final update
      const healthCheck = await performBookingHealthCheck(bookingId, bookingData.payment_intent_id);
      logHealthCheck(bookingId, healthCheck);
      
      if (!healthCheck.isHealthy) {
        console.error('❌ FATAL: Health check failed before authorization:', healthCheck.issues);
        
        // Enhanced Rollback: Cancel payment, delete transaction, delete booking
        try {
          const { data: cancelResult, error: cancelError } = await supabase.functions.invoke(
            'cancel-payment-intent',
            {
              body: {
                paymentIntentId: bookingData.payment_intent_id,
                reason: 'health_check_failed'
              }
            }
          );

          if (transactionId) {
            await supabase.from('transactions').delete().eq('id', transactionId);
          }
          
          await supabase.from('bookings').delete().eq('id', bookingId);

          console.log('✅ Complete rollback performed due to health check failure');
        } catch (rollbackError) {
          console.error('❌ Rollback failed:', rollbackError);
        }
        
        return {
          booking_id: '',
          status: 'error',
          message: `Booking validation failed: ${healthCheck.issues.join(', ')}. Payment has been cancelled.`
        };
      }
      
      const { data: updatedBooking, error: updateError } = await supabase
        .from('bookings')
        .update({ 
          status: 'authorized',
          payment_status: bookingData.payment_status 
        })
        .eq('id', bookingId)
        .select()
        .single();

      if (updateError) {
        console.error('❌ FATAL: Failed to update booking status - implementing rollback:', {
          error: updateError,
          bookingId,
          transactionId
        });

        // Enhanced Rollback: Cancel payment, delete transaction, delete booking
        try {
          // Cancel the payment with Stripe
          const { data: cancelResult, error: cancelError } = await supabase.functions.invoke(
            'cancel-payment-intent',
            {
              body: {
                paymentIntentId: bookingData.payment_intent_id,
                reason: 'booking_authorization_failed'
              }
            }
          );

          // Delete transaction record
          if (transactionId) {
            await supabase.from('transactions').delete().eq('id', transactionId);
          }
          
          // Delete temporary booking
          await supabase.from('bookings').delete().eq('id', bookingId);

          console.log('✅ Complete rollback performed');
        } catch (rollbackError) {
          console.error('❌ Rollback failed:', rollbackError);
        }
        
        return {
          booking_id: '',
          status: 'error',
          message: 'Booking authorization failed. Payment has been cancelled and will be refunded.'
        };
      }

      console.log('✅ STEP 3 SUCCESS: Booking authorized:', { bookingId });
      
    } else {
      // PHASE 1 (No Payment): DIRECT BOOKING CREATION
      console.log('📝 Creating booking without payment');
      
      const bookingInsertData = {
        customer_id: bookingData.customer_id,
        service_id: bookingData.service_id,
        scheduled_date: bookingData.scheduled_date,
        scheduled_start: bookingData.scheduled_start,
        location_notes: bookingData.location_notes,
        status: 'pending' as const,
        payment_status: 'pending'
      };

      const { data: noPmtBooking, error: noPmtBookingError } = await supabase
        .from('bookings')
        .insert(bookingInsertData)
        .select()
        .single();

      if (noPmtBookingError) {
        console.error('❌ FATAL: Booking creation failed:', noPmtBookingError);
        return {
          booking_id: '',
          status: 'error',
          message: 'Booking creation failed. Please try again.'
        };
      }

      bookingId = noPmtBooking.id;
    }

    // Use enhanced auto-assignment with coverage notifications
    const { data: assignmentResult, error: assignmentError } = await supabase
      .rpc('auto_assign_workers_with_coverage', {
        p_booking_id: bookingId
      });

    if (assignmentError) {
      console.error('Assignment error:', assignmentError);
      return {
        booking_id: bookingId!,
        status: 'pending',
        message: 'Booking created but assignment failed. Admin will assign manually.'
      };
    }

    const result = assignmentResult?.[0];
    
    if (result?.assignment_status === 'direct_assigned') {
      return {
        booking_id: bookingId!,
        status: 'confirmed',
        message: 'Booking confirmed! Worker assigned.',
        worker_assigned: true
      };
    } else if (result?.assignment_status === 'coverage_notifications_sent') {
      // Trigger the notification sending using Supabase functions
      try {
        const { error: notificationError } = await supabase.functions.invoke('notify-workers-coverage', {
          body: { bookingId }
        });

        if (notificationError) {
          console.error('Failed to send worker notifications:', notificationError);
        } else {
          console.log('Worker notifications sent successfully');
        }
      } catch (notificationError) {
        console.error('Failed to send notifications:', notificationError);
      }

      return {
        booking_id: bookingId!,
        status: 'pending',
        message: `Coverage requests sent to ${result.notifications_sent} workers in your area.`,
        notifications_sent: result.notifications_sent
      };
    }

    return {
      booking_id: bookingId!,
      status: 'pending',
      message: 'Booking created but no workers available. Admin will assign manually.',
      notifications_sent: 0
    };

  } catch (error) {
    console.error('Error creating enhanced booking:', error);
    return {
      booking_id: '',
      status: 'error',
      message: 'Failed to create booking. Please try again.'
    };
  }
};
