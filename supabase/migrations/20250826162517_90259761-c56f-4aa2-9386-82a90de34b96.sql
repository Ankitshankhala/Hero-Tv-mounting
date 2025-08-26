-- Fix worker auto-assignment and email notification triggers (Part 1: Clean up and create triggers)

-- 1. Drop existing problematic triggers and functions
DROP TRIGGER IF EXISTS auto_assign_trigger ON public.bookings;
DROP TRIGGER IF EXISTS auto_assign_workers_trigger ON public.bookings;
DROP TRIGGER IF EXISTS worker_assignment_email_trigger ON public.bookings;
DROP TRIGGER IF EXISTS auto_assign_new_bookings_trigger ON public.bookings;

DROP FUNCTION IF EXISTS public.trigger_worker_auto_assignment();
DROP FUNCTION IF EXISTS public.trigger_worker_assignment_email();

-- 2. Create improved auto-assignment trigger that works for all booking statuses
CREATE OR REPLACE FUNCTION public.trigger_worker_auto_assignment()
RETURNS TRIGGER AS $$
BEGIN
  -- Only auto-assign if no worker is currently assigned and booking needs assignment
  IF (NEW.worker_id IS NULL OR (OLD.worker_id IS NULL AND NEW.worker_id IS NULL)) 
     AND NEW.status IN ('payment_pending', 'payment_authorized', 'pending', 'confirmed')
     AND NEW.payment_status IN ('pending', 'authorized', 'completed', 'captured') THEN
    
    -- Log the auto-assignment attempt
    INSERT INTO public.sms_logs (booking_id, recipient_number, message, status, error_message)
    VALUES (NEW.id, 'system', 'Triggering auto-assignment for booking status: ' || NEW.status, 'sent', NULL);
    
    -- Call the enhanced auto-assignment function with polygon coverage
    PERFORM public.auto_assign_workers_with_polygon_coverage(NEW.id);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create trigger for worker assignment emails
CREATE OR REPLACE FUNCTION public.trigger_worker_assignment_email()
RETURNS TRIGGER AS $$
BEGIN
  -- Send email when worker is assigned (worker_id changes from NULL to a value)
  IF (OLD IS NULL OR OLD.worker_id IS NULL) AND NEW.worker_id IS NOT NULL THEN
    -- Log the email trigger
    INSERT INTO public.sms_logs (booking_id, recipient_number, message, status, error_message)
    VALUES (NEW.id, 'system', 'Triggering worker assignment email for worker: ' || NEW.worker_id, 'sent', NULL);
    
    -- Call smart email dispatcher for worker assignment
    PERFORM net.http_post(
      url := 'https://ggvplltpwsnvtcbpazbe.supabase.co/functions/v1/smart-email-dispatcher',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdndnBsbHRwd3NudnRjYnBhemJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk1MTU5NjIsImV4cCI6MjA2NTA5MTk2Mn0.cbZ4kBKP7odpP9r1Qrg4G6CA8XdW7vLdKsqr6gE0j_Q'
      ),
      body := jsonb_build_object(
        'bookingId', NEW.id,
        'workerId', NEW.worker_id,
        'emailType', 'worker_assignment',
        'source', 'auto_trigger'
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Create triggers on bookings table
CREATE TRIGGER auto_assign_workers_trigger
  AFTER UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_worker_auto_assignment();

CREATE TRIGGER worker_assignment_email_trigger
  AFTER UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_worker_assignment_email();

-- 5. Create trigger for new bookings (INSERT)
CREATE TRIGGER auto_assign_new_bookings_trigger
  AFTER INSERT ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_worker_auto_assignment();