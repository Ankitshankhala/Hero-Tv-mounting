-- Enable pg_net extension for HTTP requests from triggers
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Add validation function to prevent invalid payment_status values
CREATE OR REPLACE FUNCTION validate_payment_status()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  -- Ensure payment_status is only set to valid enum values
  IF NEW.status IS NOT NULL AND NEW.status NOT IN ('pending', 'authorized', 'completed', 'failed') THEN
    RAISE EXCEPTION 'Invalid payment status: %. Valid values are: pending, authorized, completed, failed', NEW.status;
  END IF;
  
  -- Map cancelled to failed for payment status
  IF NEW.status = 'cancelled' THEN
    NEW.status = 'failed';
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create trigger to validate payment status before insert/update
DROP TRIGGER IF EXISTS validate_payment_status_trigger ON public.transactions;
CREATE TRIGGER validate_payment_status_trigger
  BEFORE INSERT OR UPDATE ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION validate_payment_status();

-- Log the fix
INSERT INTO public.sms_logs (booking_id, recipient_number, message, status, error_message)
VALUES (NULL, 'system', 'Fixed payment status enum issue - enabled validation trigger', 'sent', NULL);