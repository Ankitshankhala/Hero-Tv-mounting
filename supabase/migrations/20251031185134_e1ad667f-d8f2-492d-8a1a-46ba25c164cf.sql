-- Disable the trigger_booking_notifications trigger to prevent duplicate emails
-- This trigger was creating 'pending' email_logs which conflicted with direct email sending from edge functions

DROP TRIGGER IF EXISTS booking_notification_trigger ON public.bookings;

-- Drop the trigger function as well since we're handling notifications entirely through edge functions
DROP FUNCTION IF EXISTS public.trigger_booking_notifications() CASCADE;

-- The edge functions (unified-email-dispatcher, send-worker-assignment-notification, send-customer-booking-confirmation-email)
-- will handle all email sending and logging directly, ensuring:
-- 1. No duplicate emails
-- 2. Immediate sending (no pending queue)
-- 3. Proper idempotency checking
-- 4. Consistent status tracking