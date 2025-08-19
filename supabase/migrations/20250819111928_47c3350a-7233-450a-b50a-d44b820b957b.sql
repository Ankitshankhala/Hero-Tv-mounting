-- Clean up watchdog and email orchestrator functions that may conflict
-- Remove watchdog triggers that might send duplicate emails
DROP TRIGGER IF EXISTS booking_created_watchdog_trigger ON public.bookings;
DROP TRIGGER IF EXISTS worker_assigned_watchdog_trigger ON public.bookings;
DROP TRIGGER IF EXISTS trg_watchdog_on_new_booking ON public.bookings;

-- Drop the watchdog functions
DROP FUNCTION IF EXISTS public.trigger_booking_notification_watchdog();
DROP FUNCTION IF EXISTS public.trigger_watchdog_on_new_booking();

-- Remove any other email notification triggers that might conflict
DROP TRIGGER IF EXISTS selective_email_notifications_trigger ON public.bookings;
DROP FUNCTION IF EXISTS public.trigger_selective_email_notifications();