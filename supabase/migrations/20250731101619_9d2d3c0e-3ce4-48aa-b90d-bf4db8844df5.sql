-- Ensure the payment status validation trigger works correctly
-- This trigger should automatically convert any 'cancelled' status to 'failed' 
-- to maintain compatibility with the payment_status enum

-- Drop and recreate the validation function to ensure it's working correctly
DROP TRIGGER IF EXISTS validate_payment_status_trigger ON transactions;
DROP FUNCTION IF EXISTS validate_payment_status();

CREATE OR REPLACE FUNCTION validate_payment_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Log for debugging
  RAISE NOTICE 'Payment status validation triggered. Input status: %', NEW.status;
  
  -- Ensure payment_status is only set to valid enum values
  IF NEW.status IS NOT NULL AND NEW.status NOT IN ('pending', 'authorized', 'completed', 'failed') THEN
    RAISE NOTICE 'Invalid payment status detected: %, converting to failed', NEW.status;
    -- Convert any invalid status to 'failed'
    NEW.status = 'failed';
  END IF;
  
  -- Specifically map cancelled to failed for payment status
  IF NEW.status = 'cancelled' THEN
    RAISE NOTICE 'Converting cancelled status to failed for payment_status enum compatibility';
    NEW.status = 'failed';
  END IF;
  
  RAISE NOTICE 'Final payment status: %', NEW.status;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger
CREATE TRIGGER validate_payment_status_trigger
  BEFORE INSERT OR UPDATE ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION validate_payment_status();