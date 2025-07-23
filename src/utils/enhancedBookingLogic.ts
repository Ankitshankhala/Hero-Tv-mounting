
import { supabase } from '@/integrations/supabase/client';
import { TransactionManager } from './transactionManager';
import { validateUSZipcode, isZipcodeInServiceArea } from '@/utils/zipcodeValidation';
import { performBookingHealthCheck, logHealthCheck } from '@/utils/bookingHealthCheck';

// Retry configuration
const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 5000, // 5 seconds
};

// Audit logging utility
const logAuditEvent = async (
  bookingId: string | null,
  paymentIntentId: string | null,
  operation: string,
  status: 'success' | 'error' | 'warning',
  details?: any,
  errorMessage?: string
) => {
  try {
    await (supabase.rpc as any)('log_booking_operation', {
      p_booking_id: bookingId,
      p_payment_intent_id: paymentIntentId,
      p_operation: operation,
      p_status: status,
      p_details: details ? JSON.stringify(details) : null,
      p_error_message: errorMessage
    });
  } catch (auditError) {
    console.error('Failed to log audit event:', auditError);
  }
};

// Retry utility with exponential backoff
const retryWithBackoff = async <T>(
  operation: () => Promise<T>,
  context: string,
  maxRetries = RETRY_CONFIG.maxRetries
): Promise<T> => {
  let lastError: Error;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      console.error(`${context} - Attempt ${attempt + 1} failed:`, error);
      
      if (attempt === maxRetries) {
        break;
      }
      
      const delay = Math.min(
        RETRY_CONFIG.baseDelay * Math.pow(2, attempt),
        RETRY_CONFIG.maxDelay
      );
      
      console.log(`${context} - Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
};

// Enhanced rollback with retry
const performEnhancedRollback = async (
  bookingId: string,
  paymentIntentId: string,
  transactionId: string | null,
  reason: string
) => {
  await logAuditEvent(bookingId, paymentIntentId, 'rollback_started', 'warning', { reason });
  
  try {
    // Step 1: Cancel payment with retry
    await retryWithBackoff(async () => {
      const { error: cancelError } = await supabase.functions.invoke(
        'cancel-payment-intent',
        {
          body: {
            paymentIntentId,
            reason
          }
        }
      );
      
      if (cancelError) throw new Error(`Payment cancellation failed: ${cancelError.message}`);
    }, 'Payment Cancellation');

    // Step 2: Delete transaction with retry
    if (transactionId) {
      await retryWithBackoff(async () => {
        const { error: transactionDeleteError } = await supabase
          .from('transactions')
          .delete()
          .eq('id', transactionId);
          
        if (transactionDeleteError) throw new Error(`Transaction deletion failed: ${transactionDeleteError.message}`);
      }, 'Transaction Deletion');
    }

    // Step 3: Delete booking with retry
    await retryWithBackoff(async () => {
      const { error: bookingDeleteError } = await supabase
        .from('bookings')
        .delete()
        .eq('id', bookingId);
        
      if (bookingDeleteError) throw new Error(`Booking deletion failed: ${bookingDeleteError.message}`);
    }, 'Booking Deletion');

    await logAuditEvent(bookingId, paymentIntentId, 'rollback_completed', 'success', { reason });
    console.log('✅ Enhanced rollback completed successfully');
    
  } catch (rollbackError) {
    await logAuditEvent(bookingId, paymentIntentId, 'rollback_failed', 'error', { reason }, rollbackError.message);
    console.error('❌ Enhanced rollback failed:', rollbackError);
    throw rollbackError;
  }
};

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
  const operationId = `booking-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Comprehensive input validation and logging
  console.log(`🚀 [${operationId}] Enhanced booking creation started`, {
    timestamp: new Date().toISOString(),
    customer_id: bookingData.customer_id,
    service_id: bookingData.service_id,
    scheduled_date: bookingData.scheduled_date,
    scheduled_start: bookingData.scheduled_start,
    customer_zipcode: bookingData.customer_zipcode,
    payment_intent_id: bookingData.payment_intent_id,
    payment_status: bookingData.payment_status,
    payment_amount: bookingData.payment_amount,
    location_notes_length: bookingData.location_notes?.length || 0
  });

  // Input validation with detailed error messages
  const validationErrors: string[] = [];

  if (!bookingData.customer_id) {
    validationErrors.push('customer_id is required');
  }
  if (!bookingData.service_id) {
    validationErrors.push('service_id is required');
  }
  if (!bookingData.scheduled_date) {
    validationErrors.push('scheduled_date is required');
  }
  if (!bookingData.scheduled_start) {
    validationErrors.push('scheduled_start is required');
  }

  if (validationErrors.length > 0) {
    const errorMessage = `Input validation failed: ${validationErrors.join(', ')}`;
    console.error(`❌ [${operationId}] ${errorMessage}`, { bookingData, validationErrors });
    await logAuditEvent(null, bookingData.payment_intent_id, 'validation_failed', 'error', { validationErrors }, errorMessage);
    
    return {
      booking_id: '',
      status: 'error',
      message: errorMessage
    };
  }

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
        // Enhanced transaction creation with detailed logging
        console.log(`💳 [${operationId}] Creating transaction with data:`, {
          booking_id: bookingId,
          payment_intent_id: bookingData.payment_intent_id,
          amount: paymentAmount,
          status: 'pending',
          transaction_type: 'authorization',
          payment_method: 'card',
          currency: 'USD'
        });

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
          console.error(`❌ [${operationId}] CRITICAL: Transaction creation failed`, {
            error: transactionError,
            errorCode: transactionError.code,
            errorDetails: transactionError.details,
            errorHint: transactionError.hint,
            errorMessage: transactionError.message,
            bookingId,
            payment_intent_id: bookingData.payment_intent_id,
            attempted_transaction_data: {
              booking_id: bookingId,
              payment_intent_id: bookingData.payment_intent_id,
              amount: paymentAmount,
              status: 'pending',
              transaction_type: 'authorization',
              payment_method: 'card',
              currency: 'USD'
            }
          });

          await logAuditEvent(bookingId, bookingData.payment_intent_id, 'transaction_creation_failed', 'error', {
            transactionError: transactionError.message,
            errorCode: transactionError.code,
            paymentAmount
          }, transactionError.message);

          // Enhanced rollback: Delete temporary booking with detailed logging
          console.log(`🔄 [${operationId}] Rolling back temporary booking due to transaction failure`);
          try {
            const { error: rollbackError } = await supabase.from('bookings').delete().eq('id', bookingId);
            if (rollbackError) {
              console.error(`❌ [${operationId}] Rollback failed:`, rollbackError);
              await logAuditEvent(bookingId, bookingData.payment_intent_id, 'rollback_failed', 'error', { rollbackError }, rollbackError.message);
            } else {
              console.log(`✅ [${operationId}] Successfully rolled back temporary booking`);
              await logAuditEvent(bookingId, bookingData.payment_intent_id, 'rollback_success', 'success', { reason: 'transaction_creation_failed' });
            }
          } catch (rollbackException) {
            console.error(`❌ [${operationId}] Rollback exception:`, rollbackException);
          }
          
          // Provide specific error message based on error type
          let userMessage = 'Payment processing failed. Please try again or contact support.';
          if (transactionError.code === '23503') {
            userMessage = 'Booking reference error. Please try creating a new booking.';
          } else if (transactionError.code === '23505') {
            userMessage = 'Duplicate transaction detected. Please refresh and try again.';
          } else if (transactionError.message?.includes('constraint')) {
            userMessage = 'Database constraint error. Please contact support with booking details.';
          }

          return {
            booking_id: '',
            status: 'error',
            message: `${userMessage} (Error: ${transactionError.code || 'UNKNOWN'})`
          };
        }

        if (!transactionData) {
          console.error(`❌ [${operationId}] Transaction created but no data returned`);
          await logAuditEvent(bookingId, bookingData.payment_intent_id, 'transaction_no_data', 'error', {}, 'Transaction insert succeeded but no data returned');
          
          return {
            booking_id: '',
            status: 'error',
            message: 'Transaction processing error. Please try again.'
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
    // Comprehensive error logging for debugging
    console.error(`❌ [${operationId}] FATAL: Unhandled error in createEnhancedBooking`, {
      error,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      errorStack: error instanceof Error ? error.stack : undefined,
      bookingId,
      transactionId,
      payment_intent_id: bookingData.payment_intent_id,
      customer_id: bookingData.customer_id,
      service_id: bookingData.service_id,
      scheduled_date: bookingData.scheduled_date,
      scheduled_start: bookingData.scheduled_start,
      timestamp: new Date().toISOString()
    });

    // Log audit event for unhandled errors
    await logAuditEvent(bookingId, bookingData.payment_intent_id, 'unhandled_error', 'error', {
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      errorStack: error instanceof Error ? error.stack : undefined,
      bookingId,
      transactionId
    }, error instanceof Error ? error.message : 'Unknown error occurred');

    // Attempt rollback if we have a booking or transaction ID
    if (bookingId || transactionId) {
      console.log(`🔄 [${operationId}] Attempting emergency rollback due to unhandled error`);
      try {
        if (bookingData.payment_intent_id) {
          // Cancel payment if payment was involved
          const { error: cancelError } = await supabase.functions.invoke('cancel-payment-intent', {
            body: {
              paymentIntentId: bookingData.payment_intent_id,
              reason: 'unhandled_error_rollback'
            }
          });
          if (cancelError) {
            console.error(`❌ [${operationId}] Payment cancellation failed during emergency rollback:`, cancelError);
          } else {
            console.log(`✅ [${operationId}] Payment cancelled during emergency rollback`);
          }
        }

        if (transactionId) {
          // Delete transaction
          const { error: transactionDeleteError } = await supabase.from('transactions').delete().eq('id', transactionId);
          if (transactionDeleteError) {
            console.error(`❌ [${operationId}] Transaction deletion failed during emergency rollback:`, transactionDeleteError);
          } else {
            console.log(`✅ [${operationId}] Transaction deleted during emergency rollback`);
          }
        }

        if (bookingId) {
          // Delete booking
          const { error: bookingDeleteError } = await supabase.from('bookings').delete().eq('id', bookingId);
          if (bookingDeleteError) {
            console.error(`❌ [${operationId}] Booking deletion failed during emergency rollback:`, bookingDeleteError);
          } else {
            console.log(`✅ [${operationId}] Booking deleted during emergency rollback`);
          }
        }

        await logAuditEvent(bookingId, bookingData.payment_intent_id, 'emergency_rollback_success', 'success', { reason: 'unhandled_error' });
      } catch (rollbackError) {
        console.error(`❌ [${operationId}] Emergency rollback failed:`, rollbackError);
        await logAuditEvent(bookingId, bookingData.payment_intent_id, 'emergency_rollback_failed', 'error', { rollbackError }, rollbackError.message);
      }
    }

    // Provide user-friendly error message based on error type
    let userMessage = 'Failed to create booking. Please try again.';
    
    if (error instanceof Error) {
      const errorMessage = error.message.toLowerCase();
      if (errorMessage.includes('network') || errorMessage.includes('connection')) {
        userMessage = 'Network error occurred. Please check your connection and try again.';
      } else if (errorMessage.includes('timeout')) {
        userMessage = 'Request timed out. Please try again.';
      } else if (errorMessage.includes('authorization') || errorMessage.includes('permission')) {
        userMessage = 'Authorization error. Please refresh the page and try again.';
      } else if (errorMessage.includes('payment')) {
        userMessage = 'Payment processing error. If your card was charged, please contact support.';
      } else if (errorMessage.includes('database') || errorMessage.includes('constraint')) {
        userMessage = 'Database error occurred. Please contact support if the issue persists.';
      }
    }

    return {
      booking_id: '',
      status: 'error',
      message: `${userMessage} (Operation ID: ${operationId.split('-').pop()})`
    };
  }
};
