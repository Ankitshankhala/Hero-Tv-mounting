-- Enhanced trigger to archive bookings when completed, regardless of payment status
CREATE OR REPLACE FUNCTION public.auto_archive_booking_on_completion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Archive booking when status changes to 'completed'
  IF NEW.status = 'completed' AND OLD.status != 'completed' 
     AND (NEW.is_archived IS FALSE OR NEW.is_archived IS NULL) THEN
    
    NEW.is_archived = true;
    NEW.archived_at = now();
    
    -- Log the archiving action
    INSERT INTO public.sms_logs (booking_id, recipient_number, message, status, error_message)
    VALUES (NEW.id, 'system', 'Booking automatically archived after completion', 'sent', NULL);
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create trigger for booking completion archiving
DROP TRIGGER IF EXISTS archive_booking_on_completion ON public.bookings;
CREATE TRIGGER archive_booking_on_completion
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_archive_booking_on_completion();