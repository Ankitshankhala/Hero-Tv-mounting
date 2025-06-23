
import { supabase } from '@/integrations/supabase/client';
import { validateUSZipcode, isZipcodeInServiceArea } from '@/utils/zipcodeValidation';

export interface EnhancedBookingData {
  customer_id: string;
  service_id: string;
  scheduled_date: string;
  scheduled_start: string;
  location_notes?: string;
  customer_zipcode?: string;
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

    // Create the booking
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .insert({
        customer_id: bookingData.customer_id,
        service_id: bookingData.service_id,
        scheduled_date: bookingData.scheduled_date,
        scheduled_start: bookingData.scheduled_start,
        location_notes: bookingData.location_notes,
        status: 'pending'
      })
      .select()
      .single();

    if (bookingError) {
      throw bookingError;
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
      // Trigger the notification sending
      try {
        await fetch('/functions/v1/notify-workers-coverage', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          },
          body: JSON.stringify({
            booking_id: booking.id,
            urgent: false
          })
        });
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
