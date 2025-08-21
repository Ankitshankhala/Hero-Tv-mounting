-- Create trigger function to send worker assignment emails automatically
CREATE OR REPLACE FUNCTION public.notify_worker_email_on_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Only trigger when worker_id changes from NULL to NOT NULL and status is confirmed
  IF OLD.worker_id IS NULL AND NEW.worker_id IS NOT NULL AND NEW.status = 'confirmed' THEN
    -- Call the worker assignment notification function asynchronously
    PERFORM net.http_post(
      url := 'https://ggvplltpwsnvtcbpazbe.supabase.co/functions/v1/send-worker-assignment-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdndnBsbHRwd3NudnRjYnBhemJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk1MTU5NjIsImV4cCI6MjA2NTA5MTk2Mn0.cbZ4kBKP7odpP9r1Qrg4G6CA8XdW7vLdKsqr6gE0j_Q'
      ),
      body := jsonb_build_object(
        'bookingId', NEW.id::text,
        'workerId', NEW.worker_id::text,
        'force', true
      )
    );
    
    -- Log the trigger action
    INSERT INTO public.sms_logs (booking_id, recipient_number, message, status, error_message)
    VALUES (NEW.id, 'system', 'Auto-trigger: Worker assignment email initiated', 'sent', NULL);
  END IF;
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log error but don't fail the booking update
  INSERT INTO public.sms_logs (booking_id, recipient_number, message, status, error_message)
  VALUES (NEW.id, 'system', 'Auto-trigger: Worker assignment email failed', 'failed', SQLERRM);
  RETURN NEW;
END;
$function$;

-- Create trigger on bookings table
DROP TRIGGER IF EXISTS trigger_worker_assignment_email ON public.bookings;
CREATE TRIGGER trigger_worker_assignment_email
  AFTER UPDATE OF worker_id ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_worker_email_on_assignment();