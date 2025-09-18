-- Update database function to use 'captured' status consistently for payment captures
-- Fix auto_archive_booking_on_completion_and_capture to check for 'captured' status
CREATE OR REPLACE FUNCTION public.auto_archive_booking_on_completion_and_capture()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Check if booking should be archived:
  -- 1. Status is 'completed' 
  -- 2. Payment status is 'captured' (updated from 'completed')
  -- 3. Not already archived
  IF NEW.status = 'completed' 
     AND NEW.payment_status = 'captured'
     AND (NEW.is_archived IS FALSE OR NEW.is_archived IS NULL) THEN
    
    NEW.is_archived = true;
    NEW.archived_at = now();
    
    -- Log the archiving action
    INSERT INTO public.sms_logs (booking_id, recipient_number, message, status, error_message)
    VALUES (NEW.id, 'system', 'Booking automatically archived after completion and payment capture', 'sent', NULL);
  END IF;
  
  RETURN NEW;
END;
$function$;