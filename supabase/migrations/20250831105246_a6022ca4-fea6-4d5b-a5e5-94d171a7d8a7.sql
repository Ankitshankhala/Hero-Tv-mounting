-- Add archive functionality for completed jobs
-- Check if archiving columns exist and add them if needed
DO $$
BEGIN
    -- Check if is_archived column exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'bookings' AND column_name = 'is_archived') THEN
        ALTER TABLE public.bookings ADD COLUMN is_archived boolean DEFAULT false;
    END IF;
    
    -- Check if archived_at column exists  
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'bookings' AND column_name = 'archived_at') THEN
        ALTER TABLE public.bookings ADD COLUMN archived_at timestamp with time zone;
    END IF;
END
$$;