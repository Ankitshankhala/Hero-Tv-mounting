
-- Add zipcode column to users table (since it was added to the form but not database)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS zipcode TEXT;

-- Add cancellation tracking columns to bookings table
ALTER TABLE public.bookings 
ADD COLUMN IF NOT EXISTS cancelled_by_worker BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS worker_cancellation_reason TEXT,
ADD COLUMN IF NOT EXISTS worker_cancelled_at TIMESTAMPTZ;

-- Create a function to handle worker cancellation and re-assignment
CREATE OR REPLACE FUNCTION handle_worker_cancellation(
  p_booking_id UUID,
  p_cancellation_reason TEXT DEFAULT NULL
)
RETURNS TABLE(reassigned_worker_id UUID, success BOOLEAN) AS $$
BEGIN
  -- Mark as cancelled by worker and reset to pending
  UPDATE bookings 
  SET 
    cancelled_by_worker = TRUE,
    worker_cancellation_reason = p_cancellation_reason,
    worker_cancelled_at = NOW(),
    worker_id = NULL,
    status = 'pending',
    updated_at = NOW()
  WHERE id = p_booking_id AND status IN ('confirmed', 'pending');
  
  -- Check if update was successful
  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::UUID, FALSE;
    RETURN;
  END IF;
  
  -- Return success
  RETURN QUERY SELECT NULL::UUID, TRUE;
END;
$$ LANGUAGE plpgsql;

-- Create index for better performance on cancellation queries
CREATE INDEX IF NOT EXISTS idx_bookings_worker_cancellation ON bookings(cancelled_by_worker, worker_cancelled_at) WHERE cancelled_by_worker = true;
