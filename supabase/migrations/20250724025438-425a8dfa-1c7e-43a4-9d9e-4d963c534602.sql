-- Add idempotency_key to transactions table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'transactions' 
        AND column_name = 'idempotency_key'
    ) THEN
        ALTER TABLE public.transactions 
        ADD COLUMN idempotency_key UUID UNIQUE NOT NULL DEFAULT gen_random_uuid();
        
        -- Create index for better performance
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_idempotency_key 
        ON public.transactions (idempotency_key);
        
        -- Create index for cleanup queries (transactions without bookings)
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_booking_id_null_created_at 
        ON public.transactions (created_at) WHERE booking_id IS NULL;
    END IF;
END $$;