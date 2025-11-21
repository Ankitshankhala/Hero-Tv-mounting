import { supabase } from '@/integrations/supabase/client';

export interface BookingValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validates that a booking has all required data for payment processing
 */
export async function validateBookingIntegrity(bookingId: string): Promise<BookingValidationResult> {
  const result: BookingValidationResult = {
    isValid: true,
    errors: [],
    warnings: []
  };

  try {
    // Fetch booking with services
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('*, booking_services(*)')
      .eq('id', bookingId)
      .single();

    if (bookingError || !booking) {
      result.isValid = false;
      result.errors.push('Booking not found');
      return result;
    }

    // Check if booking has services
    if (!booking.booking_services || booking.booking_services.length === 0) {
      result.isValid = false;
      result.errors.push('Booking has no associated services - cannot process payment');
    }

    // Validate service data integrity
    if (booking.booking_services && booking.booking_services.length > 0) {
      for (const service of booking.booking_services) {
        if (!service.service_name || service.service_name.trim() === '') {
          result.warnings.push(`Service ${service.id} has no name`);
        }
        if (service.base_price === null || service.base_price === undefined) {
          result.errors.push(`Service ${service.service_name} has no base price`);
          result.isValid = false;
        }
        if (service.quantity === null || service.quantity === undefined || service.quantity < 1) {
          result.errors.push(`Service ${service.service_name} has invalid quantity`);
          result.isValid = false;
        }
      }
    }

    // Check payment_intent_id if status is not pending
    if (booking.status !== 'pending' && booking.status !== 'cancelled' && !booking.payment_intent_id) {
      result.warnings.push('Booking has no payment_intent_id but is not in pending status');
    }

  } catch (error) {
    result.isValid = false;
    result.errors.push(`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return result;
}

/**
 * Logs booking validation failures to admin alerts
 */
export async function logBookingValidationFailure(
  bookingId: string,
  errors: string[],
  operation: string
): Promise<void> {
  try {
    await supabase.from('admin_alerts').insert({
      alert_type: 'booking_validation_failure',
      severity: 'high',
      booking_id: bookingId,
      message: `Booking validation failed during ${operation}`,
      details: {
        errors,
        operation,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Failed to log validation failure:', error);
  }
}
