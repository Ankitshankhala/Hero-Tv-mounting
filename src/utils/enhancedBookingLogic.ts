
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

    // Create the booking with payment information
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
      console.error('Booking creation error:', bookingError);
      throw bookingError;
    }

    // Create transaction record if payment intent exists
    if (bookingData.payment_intent_id && booking.id) {
      console.log('Creating transaction record for payment intent:', bookingData.payment_intent_id);
      
      // Get the payment amount from booking data or payment object
      const paymentAmount = bookingData.payment_amount || bookingData.payment?.amount || 0;
      
      console.log('Transaction details:', {
        booking_id: booking.id,
        payment_intent_id: bookingData.payment_intent_id,
        amount: paymentAmount,
        payment_status: bookingData.payment_status
      });
      
      const { error: transactionError } = await supabase
        .from('transactions')
        .insert({
          booking_id: booking.id,
          payment_intent_id: bookingData.payment_intent_id,
          amount: paymentAmount, // Use actual payment amount instead of 0
          status: bookingData.payment_status === 'authorized' ? 'pending' : 'pending',
          transaction_type: 'authorization',
          payment_method: 'card',
          currency: 'USD'
        });

      if (transactionError) {
        console.error('Transaction record creation failed:', {
          error: transactionError,
          errorCode: transactionError.code,
          errorDetails: transactionError.details,
          bookingId: booking.id,
          paymentIntentId: bookingData.payment_intent_id,
          amount: paymentAmount
        });
        
        // If transaction creation fails, it could be a critical issue
        // Log the error but don't fail the booking since payment was already authorized
        console.error('WARNING: Payment was authorized but transaction record creation failed');
      } else {
        console.log('Transaction record created successfully with amount:', paymentAmount);
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
