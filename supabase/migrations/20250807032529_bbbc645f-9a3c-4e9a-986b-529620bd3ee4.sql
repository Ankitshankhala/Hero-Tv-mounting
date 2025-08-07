-- Drop all dependent triggers first
DROP TRIGGER IF EXISTS trigger_notify_worker_assignment ON bookings;
DROP TRIGGER IF EXISTS booking_notify_worker_assignment ON bookings;
DROP TRIGGER IF EXISTS notify_worker_assignment_trigger ON bookings;

-- Now drop the function
DROP FUNCTION IF EXISTS notify_worker_assignment();

-- Create improved function that calls both email and SMS notifications
CREATE OR REPLACE FUNCTION public.notify_worker_assignment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Only trigger when worker_id changes from NULL to a value (new assignment)
  IF OLD.worker_id IS NULL AND NEW.worker_id IS NOT NULL THEN
    -- Update booking status to confirmed when worker is assigned
    UPDATE public.bookings 
    SET status = 'confirmed'
    WHERE id = NEW.id;
    
    -- Call worker assignment email notification function
    PERFORM pg_net.http_post(
      url := 'https://ggvplltpwsnvtcbpazbe.supabase.co/functions/v1/send-worker-assignment-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdndnBsbHRwd3NudnRjYnBhemJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk1MTU5NjIsImV4cCI6MjA2NTA5MTk2Mn0.cbZ4kBKP7odpP9r1Qrg4G6CA8XdW7vLdKsqr6gE0j_Q'
      ),
      body := jsonb_build_object(
        'bookingId', NEW.id::text,
        'workerId', NEW.worker_id::text
      )
    );
    
    -- Call SMS notification function
    PERFORM pg_net.http_post(
      url := 'https://ggvplltpwsnvtcbpazbe.supabase.co/functions/v1/send-sms-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdndnBsbHRwd3NudnRjYnBhemJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk1MTU5NjIsImV4cCI6MjA2NTA5MTk2Mn0.cbZ4kBKP7odpP9r1Qrg4G6CA8XdW7vLdKsqr6gE0j_Q'
      ),
      body := jsonb_build_object('bookingId', NEW.id::text)
    );
    
    -- Log the assignment for debugging
    INSERT INTO public.sms_logs (booking_id, recipient_number, message, status, error_message)
    VALUES (NEW.id, 'system', 'Worker assigned via trigger - email and SMS notifications sent', 'sent', NULL);
  END IF;
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log any errors but don't fail the booking update
  INSERT INTO public.sms_logs (booking_id, recipient_number, message, status, error_message)
  VALUES (NEW.id, 'system', 'Worker assignment notification failed', 'failed', SQLERRM);
  RETURN NEW;
END;
$function$;

-- Create the trigger
CREATE TRIGGER notify_worker_assignment_trigger
  AFTER UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_worker_assignment();