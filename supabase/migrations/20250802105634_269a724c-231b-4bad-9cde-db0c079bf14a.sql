-- Fix pg_net schema issues by properly dropping existing triggers and functions with CASCADE

-- Drop existing functions with CASCADE to remove dependent triggers
DROP FUNCTION IF EXISTS send_worker_assignment_notification() CASCADE;
DROP FUNCTION IF EXISTS send_customer_booking_confirmation() CASCADE;

-- Create improved worker assignment notification function using net.http_post
CREATE OR REPLACE FUNCTION public.send_worker_assignment_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  -- Send worker assignment email when worker_id is assigned
  IF TG_OP = 'UPDATE' AND OLD.worker_id IS NULL AND NEW.worker_id IS NOT NULL THEN
    -- Call the worker assignment email edge function using net.http_post
    PERFORM net.http_post(
      url := 'https://ggvplltpwsnvtcbpazbe.supabase.co/functions/v1/send-worker-assignment-email',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdndnBsbHRwd3NudnRjYnBhemJlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0OTUxNTk2MiwiZXhwIjoyMDY1MDkxOTYyfQ.lJl6_k3H-A2E7E-OIZWIhxjNkQC_qk5LV0rG7hJ8jLs'
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

-- Create improved customer booking confirmation function using net.http_post
CREATE OR REPLACE FUNCTION public.send_customer_booking_confirmation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  -- Send confirmation email when booking becomes confirmed
  IF TG_OP = 'UPDATE' AND OLD.status != 'confirmed' AND NEW.status = 'confirmed' THEN
    -- Call the customer confirmation email edge function using net.http_post
    PERFORM net.http_post(
      url := 'https://ggvplltpwsnvtcbpazbe.supabase.co/functions/v1/send-customer-booking-confirmation-email',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdndnBsbHRwd3NudnRjYnBhemJlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0OTUxNTk2MiwiZXhwIjoyMDY1MDkxOTYyfQ.lJl6_k3H-A2E7E-OIZWIhxjNkQC_qk5LV0rG7hJ8jLs'
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

-- Create triggers
CREATE TRIGGER trigger_send_worker_assignment_notification
    AFTER UPDATE ON public.bookings
    FOR EACH ROW
    EXECUTE FUNCTION public.send_worker_assignment_notification();

CREATE TRIGGER trigger_send_customer_booking_confirmation
    AFTER UPDATE ON public.bookings
    FOR EACH ROW
    EXECUTE FUNCTION public.send_customer_booking_confirmation();