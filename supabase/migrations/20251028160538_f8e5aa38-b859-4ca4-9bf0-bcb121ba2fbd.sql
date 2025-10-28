-- Enable required extensions for automated cleanup
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Drop and recreate the cleanup function with 3-hour default and enhanced logic
DROP FUNCTION IF EXISTS cleanup_expired_pending_bookings(integer);

CREATE OR REPLACE FUNCTION cleanup_expired_pending_bookings(grace_period_minutes integer DEFAULT 180)
RETURNS TABLE (
  id uuid,
  created_at timestamp with time zone,
  customer_id uuid,
  stripe_payment_intent_id text
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deleted_count integer := 0;
  v_cutoff_time timestamp with time zone;
BEGIN
  -- Calculate cutoff time (default 3 hours ago)
  v_cutoff_time := NOW() - (grace_period_minutes || ' minutes')::interval;
  
  -- Log cleanup attempt
  INSERT INTO sms_logs (phone_number, message, status, sent_at)
  VALUES (
    'SYSTEM',
    format('Starting cleanup of payment_pending bookings older than %s minutes (cutoff: %s)', 
           grace_period_minutes, v_cutoff_time),
    'sent',
    NOW()
  );

  -- Delete expired bookings and return their details
  RETURN QUERY
  WITH deleted_bookings AS (
    DELETE FROM bookings
    WHERE status = 'payment_pending'
      AND created_at < v_cutoff_time
    RETURNING bookings.id, bookings.created_at, bookings.customer_id, bookings.stripe_payment_intent_id
  )
  SELECT 
    db.id,
    db.created_at,
    db.customer_id,
    db.stripe_payment_intent_id
  FROM deleted_bookings db;

  -- Get count of deleted bookings
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  -- Log completion
  INSERT INTO sms_logs (phone_number, message, status, sent_at)
  VALUES (
    'SYSTEM',
    format('Cleanup completed: Removed %s expired payment_pending bookings', v_deleted_count),
    'sent',
    NOW()
  );

  RAISE NOTICE 'Cleaned up % expired bookings', v_deleted_count;
END;
$$;

-- Schedule automated cleanup to run every hour
-- This will call the edge function which handles Stripe cancellation and SQL cleanup
SELECT cron.schedule(
  'cleanup-expired-pending-bookings',
  '0 * * * *', -- Every hour at minute 0
  $$
  SELECT
    net.http_post(
        url:='https://ggvplltpwsnvtcbpazbe.supabase.co/functions/v1/cleanup-pending-bookings',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdndnBsbHRwd3NudnRjYnBhemJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk1MTU5NjIsImV4cCI6MjA2NTA5MTk2Mn0.cbZ4kBKP7odpP9r1Qrg4G6CA8XdW7vLdKsqr6gE0j_Q"}'::jsonb,
        body:=json_build_object('scheduled', true, 'timestamp', NOW())::jsonb
    ) as request_id;
  $$
);

-- Add comment for documentation
COMMENT ON FUNCTION cleanup_expired_pending_bookings IS 'Automatically removes bookings stuck in payment_pending status after grace period (default 3 hours). Returns deleted booking details for audit logging.';