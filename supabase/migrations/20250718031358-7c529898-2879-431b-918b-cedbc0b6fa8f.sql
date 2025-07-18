-- Add cancellation tracking fields to transactions table
ALTER TABLE public.transactions 
ADD COLUMN cancelled_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN cancellation_reason TEXT,
ADD COLUMN cancelled_by UUID REFERENCES public.users(id),
ADD COLUMN stripe_refund_id TEXT,
ADD COLUMN refund_amount NUMERIC;

-- Add index for faster queries on cancelled transactions
CREATE INDEX idx_transactions_cancelled_at ON public.transactions(cancelled_at) WHERE cancelled_at IS NOT NULL;

-- Add index for payment intent lookups
CREATE INDEX idx_transactions_payment_intent_id ON public.transactions(payment_intent_id) WHERE payment_intent_id IS NOT NULL;

-- Update the trigger to handle cancellation timestamps
CREATE OR REPLACE FUNCTION public.update_transaction_cancelled_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
    NEW.cancelled_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic cancellation timestamp
CREATE TRIGGER trigger_update_transaction_cancelled_at
  BEFORE UPDATE ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_transaction_cancelled_at();