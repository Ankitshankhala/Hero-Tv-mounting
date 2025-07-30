-- Fix the notify_worker_assignment trigger by removing failing pg_net calls
-- and ensuring proper status transitions
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
    
    -- Log the assignment for debugging
    INSERT INTO public.sms_logs (booking_id, recipient_number, message, status, error_message)
    VALUES (NEW.id, 'system', 'Worker assigned and booking confirmed', 'sent', NULL);
  END IF;
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log any errors but don't fail the booking update
  INSERT INTO public.sms_logs (booking_id, recipient_number, message, status, error_message)
  VALUES (NEW.id, 'system', 'Worker assignment notification failed', 'failed', SQLERRM);
  RETURN NEW;
END;
$function$;

-- Ensure the trigger exists and is properly configured
DROP TRIGGER IF EXISTS trigger_notify_worker_assignment ON public.bookings;
CREATE TRIGGER trigger_notify_worker_assignment
  AFTER UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_worker_assignment();