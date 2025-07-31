-- Update payment_status enum to support direct capture workflow
-- Handle triggers that depend on the status column

-- First, update any existing 'authorized' records to 'pending' to prevent data loss
UPDATE transactions 
SET status = 'pending'
WHERE status = 'authorized';

-- Update any booking records that might reference 'authorized' 
UPDATE bookings 
SET payment_status = 'pending'
WHERE payment_status = 'authorized';

-- Drop triggers that depend on the status column temporarily
DROP TRIGGER IF EXISTS transactions_auto_invoice_trigger ON transactions;
DROP TRIGGER IF EXISTS validate_payment_status_trigger ON transactions;

-- Remove default constraints that might conflict
ALTER TABLE transactions ALTER COLUMN status DROP DEFAULT;

-- Handle booking payment_status default if it exists
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bookings' AND column_name = 'payment_status') THEN
        ALTER TABLE bookings ALTER COLUMN payment_status DROP DEFAULT;
    END IF;
END $$;

-- Recreate the payment_status enum with only the required statuses
ALTER TYPE payment_status RENAME TO payment_status_old;

CREATE TYPE payment_status AS ENUM ('pending', 'completed', 'failed');

-- Update tables to use the new enum
ALTER TABLE transactions ALTER COLUMN status TYPE payment_status USING status::text::payment_status;

-- Update booking payment_status if it exists
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bookings' AND column_name = 'payment_status') THEN
        ALTER TABLE bookings ALTER COLUMN payment_status TYPE payment_status USING payment_status::text::payment_status;
    END IF;
END $$;

-- Restore default values with valid enum values
ALTER TABLE transactions ALTER COLUMN status SET DEFAULT 'pending'::payment_status;

DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bookings' AND column_name = 'payment_status') THEN
        ALTER TABLE bookings ALTER COLUMN payment_status SET DEFAULT 'pending'::payment_status;
    END IF;
END $$;

-- Drop the old enum type
DROP TYPE payment_status_old;

-- Update the validate_payment_status function to work with new enum values
CREATE OR REPLACE FUNCTION public.validate_payment_status()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  -- Log for debugging
  RAISE NOTICE 'Payment status validation triggered. Input status: %', NEW.status;
  
  -- Ensure payment_status is only set to valid enum values
  IF NEW.status IS NOT NULL AND NEW.status NOT IN ('pending', 'completed', 'failed') THEN
    RAISE NOTICE 'Invalid payment status detected: %, converting to failed', NEW.status;
    -- Convert any invalid status to 'failed'
    NEW.status = 'failed';
  END IF;
  
  -- Specifically map cancelled/authorized to appropriate statuses
  IF NEW.status = 'cancelled' OR NEW.status = 'authorized' THEN
    RAISE NOTICE 'Converting % status to pending for direct capture workflow', NEW.status;
    NEW.status = 'pending';
  END IF;
  
  RAISE NOTICE 'Final payment status: %', NEW.status;
  RETURN NEW;
END;
$function$;

-- Recreate the triggers
CREATE TRIGGER validate_payment_status_trigger
    BEFORE INSERT OR UPDATE ON transactions
    FOR EACH ROW
    EXECUTE FUNCTION validate_payment_status();

-- Recreate the auto-invoice trigger (if it existed)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'trigger_auto_invoice') THEN
        CREATE TRIGGER transactions_auto_invoice_trigger
            AFTER INSERT OR UPDATE ON transactions
            FOR EACH ROW
            EXECUTE FUNCTION trigger_auto_invoice();
    END IF;
END $$;