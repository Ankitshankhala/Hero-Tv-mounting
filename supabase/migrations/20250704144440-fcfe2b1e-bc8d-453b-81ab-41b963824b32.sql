-- Create a function to send SMS notification when worker is assigned
CREATE OR REPLACE FUNCTION notify_worker_assignment()
RETURNS TRIGGER AS $$
BEGIN
  -- Only trigger when worker_id changes from NULL to a value (new assignment)
  IF OLD.worker_id IS NULL AND NEW.worker_id IS NOT NULL THEN
    -- Call the send-sms-notification edge function
    PERFORM net.http_post(
      url := 'https://ggvplltpwsnvtcbpazbe.supabase.co/functions/v1/send-sms-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT get_secret('SUPABASE_SERVICE_ROLE_KEY'))
      ),
      body := jsonb_build_object('bookingId', NEW.id)
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on bookings table
DROP TRIGGER IF EXISTS trigger_notify_worker_assignment ON bookings;
CREATE TRIGGER trigger_notify_worker_assignment
  AFTER UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION notify_worker_assignment();