-- Fix the validate_payment_authorization function to use correct enum values
CREATE OR REPLACE FUNCTION public.validate_payment_authorization()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  -- If booking has payment_intent_id but status is not payment_authorized, prevent creation
  IF NEW.payment_intent_id IS NOT NULL AND NEW.status != 'payment_authorized' AND NEW.status != 'payment_pending' THEN
    RAISE EXCEPTION 'Booking with payment intent must have payment_authorized or payment_pending status, got: %', NEW.status;
  END IF;
  
  -- If booking is payment_authorized, it must have a payment_intent_id
  IF NEW.status = 'payment_authorized' AND NEW.payment_intent_id IS NULL THEN
    RAISE EXCEPTION 'Payment authorized booking must have a payment_intent_id';
  END IF;
  
  RETURN NEW;
END;
$$;