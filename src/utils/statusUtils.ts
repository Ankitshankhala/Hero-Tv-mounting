// Frontend utility for consistent status handling
export interface BookingStatus {
  booking_status: string;
  payment_status: string;
  display_status: string;
  status_color: 'green' | 'yellow' | 'red' | 'blue' | 'gray';
  user_message: string;
  action_required: boolean;
}

export const getBookingStatusForDisplay = (
  booking_status: string, 
  payment_status: string
): BookingStatus => {
  // Priority order: payment_status > booking_status
  const primaryStatus = payment_status || booking_status || 'unknown';

  switch (primaryStatus) {
    case 'pending':
      return {
        booking_status,
        payment_status,
        display_status: 'Payment Pending',
        status_color: 'yellow',
        user_message: 'Please complete your payment to confirm the booking',
        action_required: true
      };

    case 'authorized':
      return {
        booking_status,
        payment_status,
        display_status: 'Booking Confirmed',
        status_color: 'green',
        user_message: 'Payment authorized - your booking is confirmed!',
        action_required: false
      };

    case 'paid':
      return {
        booking_status,
        payment_status,
        display_status: 'Payment Complete',
        status_color: 'green',
        user_message: 'Payment completed successfully',
        action_required: false
      };

    case 'confirmed':
      return {
        booking_status,
        payment_status,
        display_status: 'Booking Confirmed',
        status_color: 'green',
        user_message: 'Your booking is confirmed and ready',
        action_required: false
      };

    case 'completed':
      return {
        booking_status,
        payment_status,
        display_status: 'Service Complete',
        status_color: 'blue',
        user_message: 'Service has been completed successfully',
        action_required: false
      };

    case 'failed':
      return {
        booking_status,
        payment_status,
        display_status: 'Payment Failed',
        status_color: 'red',
        user_message: 'Payment failed - please try again or contact support',
        action_required: true
      };

    case 'cancelled':
      return {
        booking_status,
        payment_status,
        display_status: 'Cancelled',
        status_color: 'gray',
        user_message: 'This booking has been cancelled',
        action_required: false
      };

    case 'expired':
      return {
        booking_status,
        payment_status,
        display_status: 'Expired',
        status_color: 'red',
        user_message: 'Payment session expired - please create a new booking',
        action_required: true
      };

    default:
      return {
        booking_status,
        payment_status,
        display_status: 'Unknown Status',
        status_color: 'gray',
        user_message: 'Status unknown - please contact support if this persists',
        action_required: true
      };
  }
};

export const generateBookingIdempotencyKey = (userId: string): string => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substr(2, 12);
  return `booking_${userId}_${timestamp}_${random}`;
};