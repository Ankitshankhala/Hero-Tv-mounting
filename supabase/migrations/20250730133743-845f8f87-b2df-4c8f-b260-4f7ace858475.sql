-- Fix the update_transaction_cancelled_at function to use 'failed' instead of 'cancelled'
-- This resolves the enum error: invalid input value for enum payment_status: "cancelled"

CREATE OR REPLACE FUNCTION public.update_transaction_cancelled_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
    NEW.cancelled_at = now();
    -- Map cancelled to failed to comply with payment_status enum
    NEW.status = 'failed';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = 'public';