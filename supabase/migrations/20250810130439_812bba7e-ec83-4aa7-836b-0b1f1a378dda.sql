-- Create a function to automatically trigger the watchdog
CREATE OR REPLACE FUNCTION trigger_booking_notification_watchdog()
RETURNS trigger AS $$
BEGIN
  -- Use pg_net to invoke the watchdog function
  PERFORM net.http_post(
    url := 'https://ggvplltpwsnvtcbpazbe.supabase.co/functions/v1/booking-notification-watchdog',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdndnBsbHRwd3NudnRjYnBhemJlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0OTUxNTk2MiwiZXhwIjoyMDY1MDkxOTYyfQ.0aB7-CnwNHBXAy_5rEOjmhC0Gur2X6HL4CZBECFowU4"}'::jsonb,
    body := json_build_object('bookingId', NEW.id)::jsonb
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new bookings
DROP TRIGGER IF EXISTS booking_created_watchdog_trigger ON bookings;
CREATE TRIGGER booking_created_watchdog_trigger
  AFTER INSERT ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION trigger_booking_notification_watchdog();

-- Create trigger for worker assignments
DROP TRIGGER IF EXISTS worker_assigned_watchdog_trigger ON bookings;
CREATE TRIGGER worker_assigned_watchdog_trigger
  AFTER UPDATE OF worker_id ON bookings
  FOR EACH ROW
  WHEN (OLD.worker_id IS DISTINCT FROM NEW.worker_id AND NEW.worker_id IS NOT NULL)
  EXECUTE FUNCTION trigger_booking_notification_watchdog();