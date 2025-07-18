
import { supabase } from '@/integrations/supabase/client';
import { validateUSZipcode, isZipcodeInServiceArea } from '@/utils/zipcodeValidation';

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

    // PHASE 1: TRANSACTION CREATION FIRST (Only for paid bookings)
    if (bookingData.payment_intent_id) {
      console.log('💰 STEP 1: Creating transaction record FIRST for payment intent:', bookingData.payment_intent_id);
      
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

      console.log('💰 Transaction validation passed:', {
        payment_intent_id: bookingData.payment_intent_id,
        amount: paymentAmount,
        payment_status: bookingData.payment_status
      });

      // Create transaction record FIRST with temporary booking_id
      const { data: transactionData, error: transactionError } = await supabase
        .from('transactions')
        .insert({
          booking_id: '00000000-0000-0000-0000-000000000000', // Temporary placeholder
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
        console.error('❌ FATAL: Transaction creation failed - cannot proceed with booking:', {
          error: transactionError,
          errorCode: transactionError.code,
          errorMessage: transactionError.message,
          payment_intent_id: bookingData.payment_intent_id,
          amount: paymentAmount
        });
        
        return {
          booking_id: '',
          status: 'error',
          message: `Payment processing failed: ${transactionError.message}. Please try again or contact support.`
        };
      }

      transactionId = transactionData.id;
      console.log('✅ STEP 1 SUCCESS: Transaction record created:', {
        transactionId,
        amount: paymentAmount,
        payment_intent_id: bookingData.payment_intent_id
      });
    }

    // PHASE 2: BOOKING CREATION (Only after transaction is secured)
    console.log('📝 STEP 2: Creating booking after transaction verification');
    
    const bookingInsertData = {
      customer_id: bookingData.customer_id,
      service_id: bookingData.service_id,
      scheduled_date: bookingData.scheduled_date,
      scheduled_start: bookingData.scheduled_start,
      location_notes: bookingData.location_notes,
      status: bookingData.payment_intent_id ? 'authorized' as const : 'pending' as const,
      payment_intent_id: bookingData.payment_intent_id,
      payment_status: bookingData.payment_status || 'pending'
    };

    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .insert(bookingInsertData)
      .select()
      .single();

    if (bookingError) {
      console.error('❌ FATAL: Booking creation failed after transaction was created:', {
        error: bookingError,
        transactionId,
        payment_intent_id: bookingData.payment_intent_id
      });

      // Enhanced Rollback: Cancel Stripe payment AND delete transaction
      if (transactionId && bookingData.payment_intent_id) {
        console.log('🔄 ROLLBACK: Cancelling payment and deleting transaction due to booking failure');
        
        try {
          // First, cancel the payment with Stripe
          const { data: cancelResult, error: cancelError } = await supabase.functions.invoke(
            'cancel-payment-intent',
            {
              body: {
                paymentIntentId: bookingData.payment_intent_id,
                reason: 'booking_creation_failed'
              }
            }
          );

          if (cancelError || !cancelResult?.success) {
            console.error('❌ Failed to cancel payment with Stripe:', cancelError || cancelResult);
            // Continue with database cleanup even if Stripe cancellation fails
          } else {
            console.log('✅ Payment cancelled successfully:', cancelResult);
          }

          // Then delete the transaction record
          const { error: deleteError } = await supabase
            .from('transactions')
            .delete()
            .eq('id', transactionId);
          
          if (deleteError) {
            console.error('❌ Failed to rollback transaction:', deleteError);
          } else {
            console.log('✅ Transaction deleted successfully');
          }

          // Return enhanced error with payment cancellation info
          return {
            booking_id: '',
            status: 'error',
            message: `Booking creation failed. ${cancelResult?.success ? 'Payment has been cancelled and will be refunded.' : 'Please contact support for payment refund.'}`,
          };
          
        } catch (rollbackError) {
          console.error('❌ Critical error during rollback:', rollbackError);
          return {
            booking_id: '',
            status: 'error',
            message: 'Booking creation failed and automatic refund failed. Please contact support immediately.',
          };
        }
      } else {
        // For non-payment bookings, just return error
        return {
          booking_id: '',
          status: 'error',
          message: 'Booking creation failed. Please try again.'
        };
      }
    }

    bookingId = booking.id;
    console.log('✅ STEP 2 SUCCESS: Booking created:', {
      bookingId,
      transactionId,
      payment_intent_id: bookingData.payment_intent_id
    });

    // PHASE 3: UPDATE TRANSACTION WITH ACTUAL BOOKING ID
    if (transactionId && bookingId) {
      console.log('🔗 STEP 3: Linking transaction to booking');
      
      const { error: updateError } = await supabase
        .from('transactions')
        .update({ booking_id: bookingId })
        .eq('id', transactionId);

      if (updateError) {
        console.error('❌ WARNING: Failed to link transaction to booking:', {
          error: updateError,
          transactionId,
          bookingId
        });
        // Don't fail the booking for this, but log it for manual resolution
      } else {
        console.log('✅ STEP 3 SUCCESS: Transaction linked to booking');
      }
    }

    // Use enhanced auto-assignment with coverage notifications
    const { data: assignmentResult, error: assignmentError } = await supabase
      .rpc('auto_assign_workers_with_coverage', {
        p_booking_id: booking.id
      });

    if (assignmentError) {
      console.error('Assignment error:', assignmentError);
      return {
        booking_id: booking.id,
        status: 'pending',
        message: 'Booking created but assignment failed. Admin will assign manually.'
      };
    }

    const result = assignmentResult?.[0];
    
    if (result?.assignment_status === 'direct_assigned') {
      return {
        booking_id: booking.id,
        status: 'confirmed',
        message: 'Booking confirmed! Worker assigned.',
        worker_assigned: true
      };
    } else if (result?.assignment_status === 'coverage_notifications_sent') {
      // Trigger the notification sending using Supabase functions
      try {
        const { error: notificationError } = await supabase.functions.invoke('notify-workers-coverage', {
          body: { bookingId: booking.id }
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
        booking_id: booking.id,
        status: 'pending',
        message: `Coverage requests sent to ${result.notifications_sent} workers in your area.`,
        notifications_sent: result.notifications_sent
      };
    }

    return {
      booking_id: booking.id,
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
