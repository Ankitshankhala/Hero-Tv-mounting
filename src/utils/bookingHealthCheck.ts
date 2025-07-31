import { supabase } from '@/integrations/supabase/client';

export interface HealthCheckResult {
  isHealthy: boolean;
  issues: string[];
  warnings: string[];
}

export const performBookingHealthCheck = async (
  bookingId: string,
  paymentIntentId?: string
): Promise<HealthCheckResult> => {
  const issues: string[] = [];
  const warnings: string[] = [];

  try {
    // Check booking exists and has valid status
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .single();

    if (bookingError || !booking) {
      issues.push(`Booking ${bookingId} not found or inaccessible`);
      return { isHealthy: false, issues, warnings };
    }

    // Validate payment intent consistency
    if (paymentIntentId) {
      if (booking.payment_intent_id && booking.payment_intent_id !== paymentIntentId) {
        issues.push(`Payment intent mismatch: booking has ${booking.payment_intent_id}, expected ${paymentIntentId}`);
      }

      // Check for orphaned transactions
      const { data: transactions } = await supabase
        .from('transactions')
        .select('*')
        .eq('booking_id', bookingId)
        .eq('payment_intent_id', paymentIntentId);

      if (transactions && transactions.length > 1) {
        warnings.push(`Multiple transactions found for booking ${bookingId} with payment intent ${paymentIntentId}`);
      }
    }

    // Validate status consistency
    if (booking.payment_intent_id && booking.status !== 'payment_authorized' && booking.status !== 'payment_pending') {
      issues.push(`Booking has payment intent but invalid status: ${booking.status}`);
    }

    if (booking.status === 'payment_authorized' && !booking.payment_intent_id) {
      issues.push(`Booking is authorized but missing payment intent ID`);
    }

    // Check for data integrity issues
    if (!booking.customer_id || !booking.service_id) {
      issues.push(`Booking missing required fields: customer_id=${booking.customer_id}, service_id=${booking.service_id}`);
    }

    return {
      isHealthy: issues.length === 0,
      issues,
      warnings
    };

  } catch (error) {
    issues.push(`Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return { isHealthy: false, issues, warnings };
  }
};

export const logHealthCheck = (bookingId: string, result: HealthCheckResult) => {
  if (result.isHealthy) {
    console.log(`🟢 HEALTH CHECK PASSED for booking ${bookingId}`);
    if (result.warnings.length > 0) {
      console.warn(`⚠️ Warnings for booking ${bookingId}:`, result.warnings);
    }
  } else {
    console.error(`🔴 HEALTH CHECK FAILED for booking ${bookingId}:`, result.issues);
    if (result.warnings.length > 0) {
      console.warn(`⚠️ Additional warnings:`, result.warnings);
    }
  }
};