-- Recreate the missing auto-assignment trigger for authorized bookings
CREATE OR REPLACE FUNCTION public.trigger_auto_assign_on_authorized_booking()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  -- Handle INSERT: trigger for newly inserted bookings with 'authorized' status
  IF TG_OP = 'INSERT' AND NEW.status = 'authorized' AND NEW.worker_id IS NULL THEN
    -- Call the auto-assignment function
    PERFORM public.auto_assign_workers_with_coverage(NEW.id);
  -- Handle UPDATE: trigger when status changes to 'authorized'
  ELSIF TG_OP = 'UPDATE' AND OLD.status != 'authorized' AND NEW.status = 'authorized' AND NEW.worker_id IS NULL THEN
    -- Call the auto-assignment function
    PERFORM public.auto_assign_workers_with_coverage(NEW.id);
  END IF;
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log error but don't fail the booking creation/update
  INSERT INTO public.sms_logs (booking_id, recipient_number, message, status, error_message)
  VALUES (NEW.id, 'system', 'Auto-assignment trigger failed', 'failed', SQLERRM);
  RETURN NEW;
END;
$function$;

-- Create the trigger on bookings table
DROP TRIGGER IF EXISTS trigger_auto_assign_on_authorized_booking ON public.bookings;
CREATE TRIGGER trigger_auto_assign_on_authorized_booking
  AFTER INSERT OR UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_auto_assign_on_authorized_booking();

-- Create email notification trigger for customer booking confirmations
CREATE OR REPLACE FUNCTION public.send_customer_booking_confirmation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  -- Send confirmation email when booking becomes confirmed
  IF TG_OP = 'UPDATE' AND OLD.status != 'confirmed' AND NEW.status = 'confirmed' THEN
    -- Call the customer confirmation email edge function
    PERFORM pg_net.http_post(
      url := 'https://ggvplltpwsnvtcbpazbe.supabase.co/functions/v1/send-customer-booking-confirmation-email',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdndnBsbHRwd3NudnRjYnBhemJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk1MTU5NjIsImV4cCI6MjA2NTA5MTk2Mn0.cbZ4kBKP7odpP9r1Qrg4G6CA8XdW7vLdKsqr6gE0j_Q'
      ),
      body := jsonb_build_object('bookingId', NEW.id::text)
    );
  END IF;
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log error but don't fail the booking update
  INSERT INTO public.sms_logs (booking_id, recipient_number, message, status, error_message)
  VALUES (NEW.id, 'system', 'Customer email notification failed', 'failed', SQLERRM);
  RETURN NEW;
END;
$function$;

-- Create the customer email trigger
DROP TRIGGER IF EXISTS trigger_send_customer_booking_confirmation ON public.bookings;
CREATE TRIGGER trigger_send_customer_booking_confirmation
  AFTER UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.send_customer_booking_confirmation();

-- Create email notification trigger for worker assignments
CREATE OR REPLACE FUNCTION public.send_worker_assignment_notification()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  -- Send worker assignment email when worker_id is assigned
  IF TG_OP = 'UPDATE' AND OLD.worker_id IS NULL AND NEW.worker_id IS NOT NULL THEN
    -- Call the worker assignment email edge function
    PERFORM pg_net.http_post(
      url := 'https://ggvplltpwsnvtcbpazbe.supabase.co/functions/v1/send-worker-assignment-email',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdndnBsbHRwd3NudnRjYnBhemJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk1MTU5NjIsImV4cCI6MjA2NTA5MTk2Mn0.cbZ4kBKP7odpP9r1Qrg4G6CA8XdW7vLdKsqr6gE0j_Q'
      ),
      body := jsonb_build_object('bookingId', NEW.id::text)
    );
  END IF;
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log error but don't fail the booking update
  INSERT INTO public.sms_logs (booking_id, recipient_number, message, status, error_message)
  VALUES (NEW.id, 'system', 'Worker email notification failed', 'failed', SQLERRM);
  RETURN NEW;
END;
$function$;

-- Create the worker email trigger
DROP TRIGGER IF EXISTS trigger_send_worker_assignment_notification ON public.bookings;
CREATE TRIGGER trigger_send_worker_assignment_notification
  AFTER UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.send_worker_assignment_notification();