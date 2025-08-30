-- Fix the validate_payment_authorization trigger to allow 'pending' status for bookings with payment intents
-- This is needed during the payment flow when a booking transitions from pending to payment_pending

DROP FUNCTION IF EXISTS public.validate_payment_authorization() CASCADE;

CREATE OR REPLACE FUNCTION public.validate_payment_authorization()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- If booking has payment_intent_id, it can be pending, payment_pending, payment_authorized, confirmed, or completed
  -- 'pending' is allowed during payment flow transitions
  IF NEW.payment_intent_id IS NOT NULL AND NEW.status NOT IN ('pending', 'payment_pending', 'payment_authorized', 'confirmed', 'completed') THEN
    RAISE EXCEPTION 'Booking with payment intent must have pending, payment_pending, payment_authorized, confirmed, or completed status, got: %', NEW.status;
  END IF;
  
  -- If booking is payment_authorized, it must have a payment_intent_id
  IF NEW.status = 'payment_authorized' AND NEW.payment_intent_id IS NULL THEN
    RAISE EXCEPTION 'Payment authorized booking must have a payment_intent_id';
  END IF;
  
  -- Allow completed status with payment_intent_id (after capture)
  IF NEW.status = 'completed' AND NEW.payment_intent_id IS NOT NULL THEN
    -- This is valid - payment was captured and booking is completed
    NULL;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Recreate the trigger
CREATE TRIGGER validate_payment_authorization_trigger
    BEFORE INSERT OR UPDATE ON public.bookings
    FOR EACH ROW
    EXECUTE FUNCTION public.validate_payment_authorization();