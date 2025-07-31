-- Focus only on transactions table to fix payment_status enum issues
-- Skip bookings table modifications for now

-- First, update any existing 'authorized' records to 'pending' to prevent data loss
UPDATE transactions 
SET status = 'pending'
WHERE status = 'authorized';

-- Drop ALL triggers on the transactions table that might use status column
DROP TRIGGER IF EXISTS transactions_auto_invoice_trigger ON transactions;
DROP TRIGGER IF EXISTS validate_payment_status_trigger ON transactions;
DROP TRIGGER IF EXISTS trigger_auto_invoice_on_transaction_completion ON transactions;
DROP TRIGGER IF EXISTS update_transaction_cancelled_at_trigger ON transactions;

-- Remove default constraint
ALTER TABLE transactions ALTER COLUMN status DROP DEFAULT;

-- Recreate the payment_status enum with only the 3 required statuses
ALTER TYPE payment_status RENAME TO payment_status_old;
CREATE TYPE payment_status AS ENUM ('pending', 'completed', 'failed');

-- Update transactions table to use the new enum
ALTER TABLE transactions ALTER COLUMN status TYPE payment_status USING status::text::payment_status;

-- Restore default
ALTER TABLE transactions ALTER COLUMN status SET DEFAULT 'pending'::payment_status;

-- Drop old enum
DROP TYPE payment_status_old;

-- Create the improved validation function
CREATE OR REPLACE FUNCTION public.validate_payment_status()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  RAISE NOTICE 'Payment status validation triggered. Input status: %', NEW.status;
  
  -- Ensure status is only set to valid enum values
  IF NEW.status IS NOT NULL AND NEW.status NOT IN ('pending', 'completed', 'failed') THEN
    RAISE NOTICE 'Invalid payment status detected: %, converting to failed', NEW.status;
    NEW.status = 'failed';
  END IF;
  
  -- Map any legacy statuses to new enum values
  IF NEW.status = 'cancelled' OR NEW.status = 'authorized' THEN
    RAISE NOTICE 'Converting % status to pending for direct capture workflow', NEW.status;
    NEW.status = 'pending';
  END IF;
  
  RAISE NOTICE 'Final payment status: %', NEW.status;
  RETURN NEW;
END;
$function$;

-- Recreate the validation trigger
CREATE TRIGGER validate_payment_status_trigger
    BEFORE INSERT OR UPDATE ON transactions
    FOR EACH ROW
    EXECUTE FUNCTION validate_payment_status();