-- Update payment_status enum - handle defaults properly

-- First, update any existing 'authorized' records to 'pending' to prevent data loss
UPDATE transactions 
SET status = 'pending'
WHERE status = 'authorized';

UPDATE bookings 
SET payment_status = 'pending'
WHERE payment_status = 'authorized';

-- Drop ALL triggers on the transactions table first
DROP TRIGGER IF EXISTS transactions_auto_invoice_trigger ON transactions;
DROP TRIGGER IF EXISTS validate_payment_status_trigger ON transactions;
DROP TRIGGER IF EXISTS trigger_auto_invoice_on_transaction_completion ON transactions;
DROP TRIGGER IF EXISTS update_transaction_cancelled_at_trigger ON transactions;

-- Remove ALL default constraints before type changes
ALTER TABLE transactions ALTER COLUMN status DROP DEFAULT;

-- Handle bookings payment_status column defaults
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bookings' AND column_name = 'payment_status') THEN
        ALTER TABLE bookings ALTER COLUMN payment_status DROP DEFAULT;
    END IF;
END $$;

-- Recreate the payment_status enum
ALTER TYPE payment_status RENAME TO payment_status_old;
CREATE TYPE payment_status AS ENUM ('pending', 'completed', 'failed');

-- Update transactions table
ALTER TABLE transactions ALTER COLUMN status TYPE payment_status USING status::text::payment_status;

-- Update bookings table payment_status column carefully
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bookings' AND column_name = 'payment_status') THEN
        -- Use text casting approach
        ALTER TABLE bookings ALTER COLUMN payment_status TYPE payment_status USING payment_status::text::payment_status;
    END IF;
END $$;

-- Drop old enum
DROP TYPE payment_status_old;

-- Restore defaults with new enum type
ALTER TABLE transactions ALTER COLUMN status SET DEFAULT 'pending'::payment_status;

DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bookings' AND column_name = 'payment_status') THEN
        ALTER TABLE bookings ALTER COLUMN payment_status SET DEFAULT 'pending'::payment_status;
    END IF;
END $$;

-- Recreate the validation function
CREATE OR REPLACE FUNCTION public.validate_payment_status()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  RAISE NOTICE 'Payment status validation triggered. Input status: %', NEW.status;
  
  IF NEW.status IS NOT NULL AND NEW.status NOT IN ('pending', 'completed', 'failed') THEN
    RAISE NOTICE 'Invalid payment status detected: %, converting to failed', NEW.status;
    NEW.status = 'failed';
  END IF;
  
  IF NEW.status = 'cancelled' OR NEW.status = 'authorized' THEN
    RAISE NOTICE 'Converting % status to pending for direct capture workflow', NEW.status;
    NEW.status = 'pending';
  END IF;
  
  RAISE NOTICE 'Final payment status: %', NEW.status;
  RETURN NEW;
END;
$function$;

-- Recreate essential triggers
CREATE TRIGGER validate_payment_status_trigger
    BEFORE INSERT OR UPDATE ON transactions
    FOR EACH ROW
    EXECUTE FUNCTION validate_payment_status();