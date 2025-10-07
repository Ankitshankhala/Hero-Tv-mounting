-- Phase 1: Clean up redundant unique constraints on email_logs table
-- Keep ONLY unique_booking_recipient_email_type as the single source of truth

-- Drop the constraint (not just the index)
ALTER TABLE public.email_logs DROP CONSTRAINT IF EXISTS uq_email_logs_booking_recipient_type;

-- Drop redundant unique constraints/indexes
DROP INDEX IF EXISTS public.idx_email_logs_booking_recipient_type;
DROP INDEX IF EXISTS public.idx_email_logs_unique_booking_recipient;
DROP INDEX IF EXISTS public.idx_email_logs_unique_booking_type_recipient;
DROP INDEX IF EXISTS public.idx_email_logs_unique_sent;

-- Verify we still have the essential unique constraint
-- unique_booking_recipient_email_type prevents: same booking + same recipient + same email_type
-- This is the ONLY unique constraint we need for preventing duplicates