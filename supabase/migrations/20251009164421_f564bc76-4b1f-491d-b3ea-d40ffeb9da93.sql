-- Remove worker acknowledgment requirement

-- Drop the cron job for checking expired acknowledgments
SELECT cron.unschedule('check-expired-acknowledgments');

-- Update worker_bookings table defaults to auto-acknowledge
ALTER TABLE worker_bookings 
  ALTER COLUMN ack_status SET DEFAULT 'acknowledged',
  ALTER COLUMN ack_deadline DROP DEFAULT;

-- Update existing pending acknowledgments to acknowledged
UPDATE worker_bookings 
SET ack_status = 'acknowledged', 
    ack_at = assigned_at
WHERE ack_status = 'pending';

-- Update the acknowledge_assignment function to be a no-op (keep for compatibility)
CREATE OR REPLACE FUNCTION public.acknowledge_assignment(p_booking_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Auto-acknowledge is now default, this function kept for compatibility
  RETURN TRUE;
END;
$function$;

-- Drop the reassign_expired_acknowledgments function (no longer needed)
DROP FUNCTION IF EXISTS public.reassign_expired_acknowledgments();