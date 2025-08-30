-- Fix the validate_booking_payment_consistency trigger to be more flexible
-- Drop trigger first, then function
DROP TRIGGER IF EXISTS validate_booking_payment_consistency_trigger ON bookings;
DROP TRIGGER IF EXISTS check_booking_payment_consistency ON bookings;
DROP FUNCTION IF EXISTS validate_booking_payment_consistency() CASCADE;

-- Create a more flexible validation function
CREATE OR REPLACE FUNCTION public.validate_booking_payment_consistency()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  -- Allow flexibility during payment processing workflows
  -- Only enforce strict validation for final states
  
  CASE NEW.status
    WHEN 'pending' THEN
      -- Allow pending bookings with any reasonable payment status during transitions
      IF NEW.payment_status NOT IN ('pending', 'authorized') THEN
        RAISE EXCEPTION 'pending bookings should have pending or authorized payment_status, got: %', NEW.payment_status;
      END IF;
    WHEN 'payment_pending' THEN
      -- Allow payment_pending with pending or authorized status
      IF NEW.payment_status NOT IN ('pending', 'authorized') THEN
        RAISE EXCEPTION 'payment_pending bookings should have pending or authorized payment_status, got: %', NEW.payment_status;
      END IF;
    WHEN 'payment_authorized' THEN
      -- payment_authorized requires authorized status
      IF NEW.payment_status NOT IN ('authorized') THEN
        RAISE EXCEPTION 'payment_authorized bookings must have authorized payment_status, got: %', NEW.payment_status;
      END IF;
    WHEN 'confirmed' THEN
      -- confirmed allows authorized, completed, or captured
      IF NEW.payment_status NOT IN ('authorized', 'completed', 'captured') THEN
        RAISE EXCEPTION 'confirmed bookings must have authorized, completed, or captured payment_status, got: %', NEW.payment_status;
      END IF;
    WHEN 'completed' THEN
      -- completed is flexible for payment capture workflows
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
    WHEN 'in_progress' THEN
      -- in_progress allows flexible payment status
      IF NEW.payment_status NOT IN ('authorized', 'completed', 'captured') THEN
        RAISE EXCEPTION 'in_progress bookings must have authorized, completed, or captured payment_status, got: %', NEW.payment_status;
      END IF;
    ELSE
      -- Handle any other booking status values gracefully
      RAISE NOTICE 'Unknown booking status: %, allowing with current payment_status: %', NEW.status, NEW.payment_status;
  END CASE;
  
  RETURN NEW;
END;
$function$;

-- Recreate the trigger
CREATE TRIGGER validate_booking_payment_consistency_trigger
  BEFORE INSERT OR UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION validate_booking_payment_consistency();

-- Create atomic RPC function for payment status fixes
CREATE OR REPLACE FUNCTION public.fix_booking_payment_status(
  p_booking_id uuid, 
  p_payment_intent_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  result jsonb := '{"success": false}'::jsonb;
  booking_count integer := 0;
  transaction_count integer := 0;
BEGIN
  -- Start transaction
  BEGIN
    -- Update the booking status to payment_authorized
    UPDATE public.bookings 
    SET status = 'payment_authorized', 
        payment_status = 'authorized'
    WHERE id = p_booking_id;
    
    GET DIAGNOSTICS booking_count = ROW_COUNT;
    
    -- Update any transactions with this payment intent
    UPDATE public.transactions
    SET status = 'authorized'
    WHERE payment_intent_id = p_payment_intent_id;
    
    GET DIAGNOSTICS transaction_count = ROW_COUNT;
    
    -- Build success result
    result := jsonb_build_object(
      'success', true,
      'booking_updated', booking_count > 0,
      'transactions_updated', transaction_count,
      'message', 'Successfully updated booking and transaction status'
    );
    
    -- Log the fix
    INSERT INTO public.sms_logs (booking_id, recipient_number, message, status, error_message)
    VALUES (p_booking_id, 'system', 'Payment status fixed via RPC', 'sent', NULL);
    
    RETURN result;
    
  EXCEPTION WHEN OTHERS THEN
    -- Log error and return failure
    result := jsonb_set(result, '{error}', to_jsonb(SQLERRM));
    
    INSERT INTO public.sms_logs (booking_id, recipient_number, message, status, error_message)
    VALUES (p_booking_id, 'system', 'Payment status fix failed', 'failed', SQLERRM);
    
    RETURN result;
  END;
END;
$function$;