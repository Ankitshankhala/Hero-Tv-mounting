export const VALID_WORKER_BOOKING_STATUSES = [
  'confirmed',
  'completed',
  'payment_authorized'
] as const;

export const EXCLUDED_WORKER_BOOKING_STATUSES = [
  'pending',
  'payment_pending',
  'failed',
  'cancelled'
] as const;

export const EXCLUDED_PAYMENT_STATUSES = [
  'pending',
  'payment_pending'
] as const;

export type ValidWorkerBookingStatus = typeof VALID_WORKER_BOOKING_STATUSES[number];
export type ExcludedWorkerBookingStatus = typeof EXCLUDED_WORKER_BOOKING_STATUSES[number];
export type ExcludedPaymentStatus = typeof EXCLUDED_PAYMENT_STATUSES[number];
