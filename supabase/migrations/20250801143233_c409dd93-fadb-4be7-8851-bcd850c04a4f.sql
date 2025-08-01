-- Fix payment capture validation issues
-- Update the validation trigger to allow proper status transitions

-- Drop the existing problematic validation function
DROP FUNCTION IF EXISTS public.validate_booking_payment_consistency() CASCADE;

-- Create an improved validation function that allows captured status
CREATE OR REPLACE FUNCTION public.validate_booking_payment_consistency()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  -- Ensure booking_status and payment_status are consistent
  CASE NEW.status
    WHEN 'payment_pending' THEN
      IF NEW.payment_status NOT IN ('pending') THEN
        RAISE EXCEPTION 'payment_pending bookings must have pending payment_status, got: %', NEW.payment_status;
      END IF;
    WHEN 'payment_authorized' THEN
      IF NEW.payment_status NOT IN ('authorized') THEN
        RAISE EXCEPTION 'payment_authorized bookings must have authorized payment_status, got: %', NEW.payment_status;
      END IF;
    WHEN 'confirmed' THEN
      IF NEW.payment_status NOT IN ('authorized', 'completed', 'captured') THEN
        RAISE EXCEPTION 'confirmed bookings must have authorized, completed, or captured payment_status, got: %', NEW.payment_status;
      END IF;
    WHEN 'completed' THEN
      -- Allow 'completed', 'captured', and 'authorized' for completed bookings
      -- This handles the payment capture workflow properly
      IF NEW.payment_status NOT IN ('completed', 'captured', 'authorized') THEN
        RAISE EXCEPTION 'completed bookings must have completed, captured, or authorized payment_status, got: %', NEW.payment_status;
      END IF;
    WHEN 'cancelled' THEN
      IF NEW.payment_status NOT IN ('failed', 'cancelled') THEN
        RAISE EXCEPTION 'cancelled bookings must have failed or cancelled payment_status, got: %', NEW.payment_status;
      END IF;
    WHEN 'failed' THEN
      IF NEW.payment_status NOT IN ('failed') THEN
        RAISE EXCEPTION 'failed bookings must have failed payment_status, got: %', NEW.payment_status;
      END IF;
  END CASE;
  
  RETURN NEW;
END;
$function$;

-- Recreate the trigger
DROP TRIGGER IF EXISTS check_booking_payment_consistency ON public.bookings;
CREATE TRIGGER check_booking_payment_consistency
  BEFORE INSERT OR UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.validate_booking_payment_consistency();

-- Update the payment authorization validation to be more flexible
CREATE OR REPLACE FUNCTION public.validate_payment_authorization()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  -- If booking has payment_intent_id, it can be payment_pending, payment_authorized, confirmed, or completed
  IF NEW.payment_intent_id IS NOT NULL AND NEW.status NOT IN ('payment_pending', 'payment_authorized', 'confirmed', 'completed') THEN
    RAISE EXCEPTION 'Booking with payment intent must have payment_pending, payment_authorized, confirmed, or completed status, got: %', NEW.status;
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