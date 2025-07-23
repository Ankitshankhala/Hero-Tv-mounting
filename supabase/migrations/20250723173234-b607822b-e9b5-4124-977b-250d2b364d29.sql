-- Make booking_id nullable in transactions table to support payment-first flow
ALTER TABLE public.transactions ALTER COLUMN booking_id DROP NOT NULL;

-- Add 'authorized' status to payment_status enum if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'authorized' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'payment_status')) THEN
        ALTER TYPE payment_status ADD VALUE 'authorized';
    END IF;
END $$;

-- Add index for faster payment_intent_id lookups if not exists
CREATE INDEX IF NOT EXISTS idx_transactions_payment_intent_lookup ON public.transactions(payment_intent_id) WHERE payment_intent_id IS NOT NULL;