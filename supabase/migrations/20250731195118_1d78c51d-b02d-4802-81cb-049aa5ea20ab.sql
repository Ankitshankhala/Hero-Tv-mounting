-- Update the validation trigger to allow confirmed status for bookings with payment intents
CREATE OR REPLACE FUNCTION public.validate_payment_authorization()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  -- If booking has payment_intent_id, it can be payment_pending, payment_authorized, or confirmed
  IF NEW.payment_intent_id IS NOT NULL AND NEW.status NOT IN ('payment_pending', 'payment_authorized', 'confirmed') THEN
    RAISE EXCEPTION 'Booking with payment intent must have payment_pending, payment_authorized, or confirmed status, got: %', NEW.status;
  END IF;
  
  -- If booking is payment_authorized, it must have a payment_intent_id
  IF NEW.status = 'payment_authorized' AND NEW.payment_intent_id IS NULL THEN
    RAISE EXCEPTION 'Payment authorized booking must have a payment_intent_id';
  END IF;
  
  -- If booking is confirmed with a payment_intent_id, that's valid too
  IF NEW.status = 'confirmed' AND NEW.payment_intent_id IS NOT NULL THEN
    -- This is valid - payment was authorized and booking is confirmed
    NULL;
  END IF;
  
  RETURN NEW;
END;
$function$;