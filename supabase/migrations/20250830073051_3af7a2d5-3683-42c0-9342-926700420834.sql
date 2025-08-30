-- Step 4: Create/update the payment authorization trigger to use idempotent assignment
CREATE OR REPLACE FUNCTION public.update_booking_on_payment_auth()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  assignment_result RECORD;
BEGIN
  -- Only trigger when status changes to payment_authorized
  IF NEW.status = 'payment_authorized' AND OLD.status != 'payment_authorized' THEN
    -- Call auto-assignment with polygon coverage using idempotent function
    FOR assignment_result IN 
      SELECT * FROM public.auto_assign_workers_with_polygon_coverage(NEW.id)
    LOOP
      -- Log the assignment result
      INSERT INTO public.sms_logs (booking_id, recipient_number, message, status, error_message)
      VALUES (NEW.id, 'system', 
        'Auto-assignment triggered by payment auth: ' || assignment_result.assignment_status,
        'sent', NULL);
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Ensure the trigger exists
DROP TRIGGER IF EXISTS update_booking_on_payment_auth ON bookings;
CREATE TRIGGER update_booking_on_payment_auth
  AFTER UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION update_booking_on_payment_auth();