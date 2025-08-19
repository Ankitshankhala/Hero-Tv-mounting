-- Add unique index for safe upserts on worker_booking_preferences
CREATE UNIQUE INDEX IF NOT EXISTS idx_worker_booking_preferences_unique 
ON public.worker_booking_preferences(worker_id, booking_id);

-- Add an optional reason column for tracking why bookings are hidden/deleted
ALTER TABLE public.worker_booking_preferences 
ADD COLUMN IF NOT EXISTS reason TEXT;