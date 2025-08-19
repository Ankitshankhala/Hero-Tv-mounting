-- Temporarily disable problematic triggers that might cause email loops
-- These can be re-enabled after debugging

-- Disable the general email notification trigger
ALTER TABLE public.bookings DISABLE TRIGGER bookings_email_notification_trigger;

-- Disable the payment pending notification trigger that fires on INSERT
ALTER TABLE public.bookings DISABLE TRIGGER trigger_payment_pending_notification;

-- Disable the booking notification triggers that might loop
ALTER TABLE public.bookings DISABLE TRIGGER booking_notifications_trigger;

-- Disable the watchdog triggers temporarily
ALTER TABLE public.bookings DISABLE TRIGGER booking_created_watchdog_trigger;
ALTER TABLE public.bookings DISABLE TRIGGER trg_watchdog_on_new_booking;
ALTER TABLE public.bookings DISABLE TRIGGER worker_assigned_watchdog_trigger;

-- Log this action
INSERT INTO public.sms_logs (booking_id, recipient_number, message, status, error_message)
VALUES (NULL, 'system', 'Disabled email triggers to stop continuous sending', 'sent', 'Emergency disable due to continuous email sending');