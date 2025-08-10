-- Create trigger function to call the booking-notification-watchdog Edge Function
CREATE OR REPLACE FUNCTION public.trigger_watchdog_on_new_booking()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Fire the watchdog only for new bookings (INSERT time).
  PERFORM net.http_post(
    url := 'https://ggvplltpwsnvtcbpazbe.supabase.co/functions/v1/booking-notification-watchdog',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdndnBsbHRwd3NudnRjYnBhemJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk1MTU5NjIsImV4cCI6MjA2NTA5MTk2Mn0.cbZ4kBKP7odpP9r1Qrg4G6CA8XdW7vLdKsqr6gE0j_Q'
    ),
    body := jsonb_build_object('bookingId', NEW.id::text)
  );

  -- Optional: log for visibility
  INSERT INTO public.sms_logs (booking_id, recipient_number, message, status, error_message)
  VALUES (NEW.id, 'system', 'Watchdog triggered for new booking', 'sent', NULL);

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log, but don't block the booking creation
  INSERT INTO public.sms_logs (booking_id, recipient_number, message, status, error_message)
  VALUES (NEW.id, 'system', 'Watchdog trigger failed for new booking', 'failed', SQLERRM);
  RETURN NEW;
END;
$function$;

-- Ensure we only have a single clean trigger on INSERT for bookings
DROP TRIGGER IF EXISTS trg_watchdog_on_new_booking ON public.bookings;

CREATE TRIGGER trg_watchdog_on_new_booking
AFTER INSERT ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION public.trigger_watchdog_on_new_booking();