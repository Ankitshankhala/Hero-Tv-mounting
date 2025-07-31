// Shared utility for mapping Stripe statuses to internal statuses
// This ensures consistency across all edge functions

export interface StatusMapping {
  internal_status: 'pending' | 'authorized' | 'completed' | 'failed' | 'captured';
  payment_status: 'pending' | 'authorized' | 'completed' | 'failed' | 'captured' | 'cancelled';
  booking_status: 'pending' | 'payment_pending' | 'payment_authorized' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'failed';
  user_message: string;
  action_required: boolean;
}

export const mapStripeStatus = (stripeStatus: string, context: 'payment_intent' | 'charge' = 'payment_intent'): StatusMapping => {
  switch (stripeStatus) {
    case 'requires_payment_method':
    case 'requires_confirmation':
    case 'requires_action':
      return {
        internal_status: 'pending',
        payment_status: 'pending',
        booking_status: 'pending',
        user_message: 'Payment authorization in progress',
        action_required: true
      };

    case 'processing':
      return {
        internal_status: 'pending',
        payment_status: 'pending',
        booking_status: 'pending',
        user_message: 'Processing payment authorization',
        action_required: false
      };

    case 'requires_capture':
      return {
        internal_status: 'authorized',
        payment_status: 'authorized',
        booking_status: 'payment_authorized',
        user_message: 'Payment authorized successfully - booking confirmed',
        action_required: false
      };

    case 'succeeded':
      return {
        internal_status: 'captured',
        payment_status: 'captured',
        booking_status: 'completed',
        user_message: 'Payment completed successfully',
        action_required: false
      };

    case 'canceled':
    case 'cancelled':
      return {
        internal_status: 'failed',
        payment_status: 'failed',
        booking_status: 'cancelled',
        user_message: 'Payment was cancelled',
        action_required: false
      };

    case 'payment_failed':
      return {
        internal_status: 'failed',
        payment_status: 'failed',
        booking_status: 'failed',
        user_message: 'Payment authorization failed - please try again',
        action_required: true
      };

    default:
      console.warn(`Unknown Stripe status: ${stripeStatus}`);
      return {
        internal_status: 'pending',
        payment_status: 'pending',
        booking_status: 'pending',
        user_message: 'Payment status unknown - please contact support',
        action_required: true
      };
  }
};

export const getStatusForFrontend = (
  booking_status: string, 
  payment_status: string, 
  internal_status?: string
): {
  display_status: string;
  status_color: 'green' | 'yellow' | 'red' | 'blue' | 'gray';
  user_message: string;
  action_required: boolean;
} => {
  // Priority order: payment_status > booking_status > internal_status
  const primaryStatus = payment_status || booking_status || internal_status || 'unknown';

  switch (primaryStatus) {
    case 'pending':
    case 'payment_pending':
      return {
        display_status: 'Payment Pending',
        status_color: 'yellow',
        user_message: 'Waiting for payment authorization',
        action_required: true
      };

    case 'authorized':
    case 'payment_authorized':
      return {
        display_status: 'Booking Confirmed',
        status_color: 'green',
        user_message: 'Payment authorized - booking is confirmed',
        action_required: false
      };

    case 'completed':
    case 'captured':
      return {
        display_status: 'Payment Complete',
        status_color: 'green',
        user_message: 'Payment completed successfully',
        action_required: false
      };

    case 'confirmed':
      return {
        display_status: 'Booking Confirmed',
        status_color: 'green',
        user_message: 'Your booking is confirmed',
        action_required: false
      };

    case 'failed':
      return {
        display_status: 'Payment Failed',
        status_color: 'red',
        user_message: 'Payment authorization failed - please try again',
        action_required: true
      };

    case 'cancelled':
      return {
        display_status: 'Cancelled',
        status_color: 'gray',
        user_message: 'Booking has been cancelled',
        action_required: false
      };

    case 'expired':
      return {
        display_status: 'Expired',
        status_color: 'red',
        user_message: 'Payment session expired - please create a new booking',
        action_required: true
      };

    default:
      return {
        display_status: 'Unknown Status',
        status_color: 'gray',
        user_message: 'Status unknown - please contact support',
        action_required: true
      };
  }
};