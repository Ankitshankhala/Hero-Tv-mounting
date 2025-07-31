-- Fix the validate_payment_status function to allow 'authorized' status
-- This function was incorrectly converting 'authorized' to 'pending' causing payment flow issues

CREATE OR REPLACE FUNCTION public.validate_payment_status()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  RAISE NOTICE 'Payment status validation triggered. Input status: %', NEW.status;
  
  -- Ensure status is only set to valid enum values including 'authorized'
  IF NEW.status IS NOT NULL AND NEW.status NOT IN ('pending', 'authorized', 'completed', 'failed') THEN
    RAISE NOTICE 'Invalid payment status detected: %, converting to failed', NEW.status;
    NEW.status = 'failed';
  END IF;
  
  -- Remove the problematic conversion that was changing 'authorized' to 'pending'
  -- This was breaking the payment authorization workflow
  IF NEW.status = 'cancelled' THEN
    RAISE NOTICE 'Converting cancelled status to failed: %', NEW.status;
    NEW.status = 'failed';
  END IF;
  
  RAISE NOTICE 'Final payment status: %', NEW.status;
  RETURN NEW;
END;
$function$;

-- Ensure the payment_status enum includes all necessary values
-- Add 'authorized' if it doesn't exist (this will fail silently if it already exists)
DO $$ 
BEGIN
    ALTER TYPE payment_status ADD VALUE 'authorized';
EXCEPTION 
    WHEN duplicate_object THEN null;
END $$;