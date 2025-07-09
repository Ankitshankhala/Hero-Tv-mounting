-- Fix the notify_worker_assignment trigger function to properly send SMS notifications
CREATE OR REPLACE FUNCTION public.notify_worker_assignment()
RETURNS TRIGGER AS $$
BEGIN
  -- Only trigger when worker_id changes from NULL to a value (new assignment)
  IF OLD.worker_id IS NULL AND NEW.worker_id IS NOT NULL THEN
    -- Call the send-sms-notification edge function directly using pg_net
    PERFORM pg_net.http_post(
      url := 'https://ggvplltpwsnvtcbpazbe.supabase.co/functions/v1/send-sms-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdndnBsbHRwd3NudnRjYnBhemJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk1MTU5NjIsImV4cCI6MjA2NTA5MTk2Mn0.cbZ4kBKP7odpP9r1Qrg4G6CA8XdW7vLdKsqr6gE0j_Q'
      ),
      body := jsonb_build_object('bookingId', NEW.id::text)
    );
    
    -- Log the SMS trigger attempt for debugging
    INSERT INTO sms_logs (booking_id, recipient_number, message, status, error_message)
    VALUES (NEW.id, 'trigger', 'Worker assignment SMS triggered', 'sent', NULL);
  END IF;
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log any errors but don't fail the booking update
  INSERT INTO sms_logs (booking_id, recipient_number, message, status, error_message)
  VALUES (NEW.id, 'system', 'Worker assignment SMS trigger failed', 'failed', SQLERRM);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure the trigger exists and is active
DROP TRIGGER IF EXISTS trigger_notify_worker_assignment ON bookings;
CREATE TRIGGER trigger_notify_worker_assignment
  AFTER UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION notify_worker_assignment();

-- Create a manual function to resend SMS for existing bookings
CREATE OR REPLACE FUNCTION public.resend_worker_sms(booking_id_param UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- Call the send-sms-notification edge function
  PERFORM pg_net.http_post(
    url := 'https://ggvplltpwsnvtcbpazbe.supabase.co/functions/v1/send-sms-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdndnBsbHRwd3NudnRjYnBhemJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk1MTU5NjIsImV4cCI6MjA2NTA5MTk2Mn0.cbZ4kBKP7odpP9r1Qrg4G6CA8XdW7vLdKsqr6gE0j_Q'
    ),
    body := jsonb_build_object('bookingId', booking_id_param::text)
  );
  
  -- Log the manual SMS trigger
  INSERT INTO sms_logs (booking_id, recipient_number, message, status, error_message)
  VALUES (booking_id_param, 'manual', 'Manual SMS resend triggered', 'sent', NULL);
  
  RETURN TRUE;
EXCEPTION WHEN OTHERS THEN
  -- Log error
  INSERT INTO sms_logs (booking_id, recipient_number, message, status, error_message)
  VALUES (booking_id_param, 'manual', 'Manual SMS resend failed', 'failed', SQLERRM);
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;