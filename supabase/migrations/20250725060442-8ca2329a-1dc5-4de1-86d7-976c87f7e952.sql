-- Update the notify_worker_assignment trigger function to also send email notifications
CREATE OR REPLACE FUNCTION public.notify_worker_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  -- Only trigger when worker_id changes from NULL to a value (new assignment)
  IF OLD.worker_id IS NULL AND NEW.worker_id IS NOT NULL THEN
    -- Call the send-sms-notification edge function
    PERFORM net.http_post(
      url := 'https://ggvplltpwsnvtcbpazbe.supabase.co/functions/v1/send-sms-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdndnBsbHRwd3NudnRjYnBhemJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk1MTU5NjIsImV4cCI6MjA2NTA5MTk2Mn0.cbZ4kBKP7odpP9r1Qrg4G6CA8XdW7vLdKsqr6gE0j_Q'
      ),
      body := jsonb_build_object('bookingId', NEW.id::text)
    );
    
    -- Call the send-worker-assignment-email edge function
    PERFORM net.http_post(
      url := 'https://ggvplltpwsnvtcbpazbe.supabase.co/functions/v1/send-worker-assignment-email',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdndnBsbHRwd3NudnRjYnBhemJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk1MTU5NjIsImV4cCI6MjA2NTA5MTk2Mn0.cbZ4kBKP7odpP9r1Qrg4G6CA8XdW7vLdKsqr6gE0j_Q'
      ),
      body := jsonb_build_object('bookingId', NEW.id::text)
    );
    
    -- Log the notification triggers for debugging
    INSERT INTO sms_logs (booking_id, recipient_number, message, status, error_message)
    VALUES (NEW.id, 'trigger', 'Worker assignment SMS and Email triggered', 'sent', NULL);
  END IF;
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log any errors but don't fail the booking update
  INSERT INTO sms_logs (booking_id, recipient_number, message, status, error_message)
  VALUES (NEW.id, 'system', 'Worker assignment notification trigger failed', 'failed', SQLERRM);
  RETURN NEW;
END;
$function$;