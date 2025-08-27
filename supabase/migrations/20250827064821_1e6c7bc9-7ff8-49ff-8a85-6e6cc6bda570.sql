-- Fix booking creation flow by removing premature status changes

-- 1. Drop the problematic BEFORE trigger that sets status to 'confirmed' too early
DROP TRIGGER IF EXISTS assign_worker_trigger ON public.bookings;

-- 2. Drop the auto_assign_worker function that was causing premature confirmations
DROP FUNCTION IF EXISTS public.auto_assign_worker();

-- 3. Update trigger_worker_auto_assignment to only run after payment is authorized
CREATE OR REPLACE FUNCTION public.trigger_worker_auto_assignment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  -- Only auto-assign if payment is authorized/completed and no worker is assigned
  IF NEW.worker_id IS NULL 
     AND NEW.payment_status IN ('authorized', 'completed', 'captured')
     AND (OLD.payment_status IS NULL OR OLD.payment_status != NEW.payment_status) THEN
    
    -- Log the auto-assignment attempt
    INSERT INTO public.sms_logs (booking_id, recipient_number, message, status, error_message)
    VALUES (NEW.id, 'system', 'Triggering auto-assignment after payment authorization: ' || NEW.payment_status, 'sent', NULL);
    
    -- Call the enhanced auto-assignment function
    PERFORM public.auto_assign_workers_with_polygon_coverage(NEW.id);
  END IF;
  
  RETURN NEW;
END;
$function$;

-- 4. Ensure the trigger only fires on UPDATE when payment status changes
DROP TRIGGER IF EXISTS trigger_worker_auto_assignment ON public.bookings;
CREATE TRIGGER trigger_worker_auto_assignment
  AFTER UPDATE ON public.bookings
  FOR EACH ROW
  WHEN (NEW.payment_status IS DISTINCT FROM OLD.payment_status)
  EXECUTE FUNCTION public.trigger_worker_auto_assignment();