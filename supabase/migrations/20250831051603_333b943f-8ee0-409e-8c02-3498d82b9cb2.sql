-- Fix the validation function to use correct enum values
CREATE OR REPLACE FUNCTION public.validate_payment_authorization()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  -- If booking has payment_intent_id, it can be pending, payment_pending, confirmed, or completed
  IF NEW.payment_intent_id IS NOT NULL AND NEW.status NOT IN ('pending', 'payment_pending', 'confirmed', 'completed') THEN
    RAISE EXCEPTION 'Booking with payment intent must have pending, payment_pending, confirmed, or completed status, got: %', NEW.status;
  END IF;
  
  -- If booking is confirmed with payment_intent_id, it's payment authorized
  IF NEW.status = 'confirmed' AND NEW.payment_intent_id IS NOT NULL THEN
    -- This is valid - payment was authorized and booking is confirmed
    NULL;
  END IF;
  
  -- Allow completed status with payment_intent_id (after capture)
  IF NEW.status = 'completed' AND NEW.payment_intent_id IS NOT NULL THEN
    -- This is valid - payment was captured and booking is completed
    NULL;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Fix the update function to use correct status
CREATE OR REPLACE FUNCTION public.update_booking_on_payment_auth()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  assignment_result RECORD;
BEGIN
  -- Only trigger when status changes to confirmed (which means payment authorized)
  IF NEW.status = 'confirmed' AND OLD.status != 'confirmed' AND NEW.payment_intent_id IS NOT NULL THEN
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

-- Now create the missing transaction records
INSERT INTO transactions (booking_id, amount, status, transaction_type, payment_method, currency)
VALUES 
  ('a3f479c5-97b5-4efd-92f3-05ce9e5512b3', 165, 'completed', 'capture', 'card', 'USD'),
  ('a5db0396-35c2-472d-89fd-06166f55e316', 165, 'completed', 'capture', 'card', 'USD');

-- Update the specific bookings to completed and archived
UPDATE bookings 
SET status = 'completed', 
    payment_status = 'completed',
    is_archived = true, 
    archived_at = now()
WHERE id IN ('a3f479c5-97b5-4efd-92f3-05ce9e5512b3', 'a5db0396-35c2-472d-89fd-06166f55e316');