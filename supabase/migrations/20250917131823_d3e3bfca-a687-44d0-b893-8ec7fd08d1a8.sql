-- Add unique constraint for worker_service_zipcodes to prevent duplicate worker-zipcode pairs
-- This ensures deterministic upsert behavior and data integrity

-- First check if constraint already exists
DO $$
BEGIN
    -- Only add constraint if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'uq_wsz_worker_zip'
    ) THEN
        ALTER TABLE public.worker_service_zipcodes 
        ADD CONSTRAINT uq_wsz_worker_zip UNIQUE (worker_id, zipcode);
    END IF;
END $$;