-- Add missing worker_assignment_email_sent column to bookings table
-- This column is referenced by trigger_booking_notifications() trigger
ALTER TABLE public.bookings 
ADD COLUMN IF NOT EXISTS worker_assignment_email_sent boolean 
DEFAULT false 
NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.bookings.worker_assignment_email_sent IS 
'Tracks whether the worker assignment notification email has been sent for this booking';