-- Create/update trigger to mark bookings as completed when payment is captured
CREATE OR REPLACE FUNCTION public.auto_complete_booking_on_payment_capture()
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
    
    -- If booking exists and is confirmed, mark it as completed
    IF FOUND AND booking_record.status = 'confirmed' THEN
      
      UPDATE public.bookings 
      SET status = 'completed', payment_status = 'completed'
      WHERE id = NEW.booking_id;
      
      -- Log the completion
      INSERT INTO public.sms_logs (booking_id, recipient_number, message, status, error_message)
      VALUES (NEW.booking_id, 'system', 'Booking marked as completed after payment capture', 'sent', NULL);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create trigger for auto-completing bookings on payment capture
DROP TRIGGER IF EXISTS trigger_auto_complete_booking_on_payment_capture ON transactions;
CREATE TRIGGER trigger_auto_complete_booking_on_payment_capture
AFTER UPDATE ON transactions
FOR EACH ROW
EXECUTE FUNCTION auto_complete_booking_on_payment_capture();

-- Backfill: Mark existing confirmed bookings with completed payments as completed
UPDATE public.bookings 
SET status = 'completed', payment_status = 'completed'
WHERE status = 'confirmed' 
AND id IN (
  SELECT DISTINCT booking_id 
  FROM transactions 
  WHERE status = 'completed' 
  AND transaction_type = 'capture'
);

-- Backfill: Archive completed bookings with completed payments
UPDATE public.bookings 
SET is_archived = true, archived_at = now()
WHERE status = 'completed' 
AND payment_status = 'completed'
AND (is_archived IS FALSE OR is_archived IS NULL);