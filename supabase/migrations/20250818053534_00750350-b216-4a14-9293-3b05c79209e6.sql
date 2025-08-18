-- Add archiving columns to bookings table
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS is_archived boolean DEFAULT false;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS archived_at timestamp with time zone;

-- Create index for performance on archived bookings queries
CREATE INDEX IF NOT EXISTS idx_bookings_is_archived ON public.bookings(is_archived);
CREATE INDEX IF NOT EXISTS idx_bookings_archived_at ON public.bookings(archived_at) WHERE archived_at IS NOT NULL;

-- Function to automatically archive completed and paid bookings
CREATE OR REPLACE FUNCTION public.auto_archive_booking_on_completion_and_capture()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Check if booking should be archived:
  -- 1. Status is 'completed' 
  -- 2. Payment status is 'completed' or 'captured'
  -- 3. Not already archived
  IF NEW.status = 'completed' 
     AND NEW.payment_status IN ('completed', 'captured')
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

-- Create trigger for booking updates
DROP TRIGGER IF EXISTS trigger_auto_archive_booking ON public.bookings;
CREATE TRIGGER trigger_auto_archive_booking
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_archive_booking_on_completion_and_capture();

-- Function to archive bookings when payment is captured (transaction completion)
CREATE OR REPLACE FUNCTION public.auto_archive_booking_on_payment_capture()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  booking_record RECORD;
BEGIN
  -- Only process when transaction status changes to 'completed' and it's a capture
  IF NEW.status = 'completed' AND OLD.status != 'completed' AND NEW.transaction_type = 'capture' THEN
    
    -- Get the associated booking
    SELECT * INTO booking_record
    FROM public.bookings 
    WHERE id = NEW.booking_id;
    
    -- If booking exists, is completed, and not already archived, archive it
    IF FOUND AND booking_record.status = 'completed' 
       AND (booking_record.is_archived IS FALSE OR booking_record.is_archived IS NULL) THEN
      
      UPDATE public.bookings 
      SET is_archived = true, archived_at = now()
      WHERE id = NEW.booking_id;
      
      -- Log the archiving action
      INSERT INTO public.sms_logs (booking_id, recipient_number, message, status, error_message)
      VALUES (NEW.booking_id, 'system', 'Booking automatically archived after payment capture', 'sent', NULL);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create trigger for transaction updates
DROP TRIGGER IF EXISTS trigger_auto_archive_on_capture ON public.transactions;
CREATE TRIGGER trigger_auto_archive_on_capture
  AFTER UPDATE ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_archive_booking_on_payment_capture();