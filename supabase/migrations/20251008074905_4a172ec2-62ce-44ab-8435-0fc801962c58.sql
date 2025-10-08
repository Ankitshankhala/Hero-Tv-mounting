-- Phase 1: Database Schema Enhancement for Worker Tip Tracking

-- Add tip_amount column to bookings table
ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS tip_amount NUMERIC DEFAULT 0;

-- Backfill from existing JSONB data
UPDATE bookings 
SET tip_amount = CAST(guest_customer_info->>'tipAmount' AS NUMERIC)
WHERE guest_customer_info->>'tipAmount' IS NOT NULL 
  AND (tip_amount IS NULL OR tip_amount = 0);

-- Add tip tracking columns to transactions table
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS tip_amount NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS base_amount NUMERIC DEFAULT 0;

-- Update existing transactions to split tip from total
UPDATE transactions t
SET 
  tip_amount = COALESCE((
    SELECT b.tip_amount
    FROM bookings b
    WHERE b.id = t.booking_id
  ), 0),
  base_amount = t.amount - COALESCE((
    SELECT b.tip_amount
    FROM bookings b
    WHERE b.id = t.booking_id
  ), 0)
WHERE t.tip_amount = 0 AND t.base_amount = 0;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_bookings_tip_amount ON bookings(tip_amount) WHERE tip_amount > 0;
CREATE INDEX IF NOT EXISTS idx_bookings_worker_tip ON bookings(worker_id, tip_amount) WHERE tip_amount > 0;

-- Create materialized view for worker tips summary
CREATE MATERIALIZED VIEW IF NOT EXISTS worker_tips_summary AS
SELECT 
  b.worker_id,
  u.name as worker_name,
  u.email as worker_email,
  COUNT(*) as total_bookings_with_tips,
  SUM(b.tip_amount) as total_tips_received,
  AVG(b.tip_amount) as average_tip,
  MIN(b.tip_amount) as min_tip,
  MAX(b.tip_amount) as max_tip,
  MAX(b.scheduled_date) as last_tip_date
FROM bookings b
INNER JOIN users u ON b.worker_id = u.id
WHERE b.tip_amount > 0
  AND b.worker_id IS NOT NULL
GROUP BY b.worker_id, u.name, u.email;

-- Create index on materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_worker_tips_summary_worker_id ON worker_tips_summary(worker_id);

-- Phase 2: Backend Functions

-- Function to get detailed tips for a specific worker
CREATE OR REPLACE FUNCTION get_worker_tips_detail(
  p_worker_id UUID,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS TABLE (
  booking_id UUID,
  customer_name TEXT,
  customer_email TEXT,
  service_name TEXT,
  booking_date DATE,
  tip_amount NUMERIC,
  base_amount NUMERIC,
  total_amount NUMERIC,
  payment_status TEXT
) 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    b.id as booking_id,
    COALESCE(u.name, b.guest_customer_info->>'name') as customer_name,
    COALESCE(u.email, b.guest_customer_info->>'email') as customer_email,
    bs.service_name,
    b.scheduled_date as booking_date,
    b.tip_amount,
    COALESCE(t.base_amount, 0) as base_amount,
    COALESCE(t.amount, 0) as total_amount,
    b.payment_status::TEXT
  FROM bookings b
  LEFT JOIN users u ON b.customer_id = u.id
  LEFT JOIN booking_services bs ON b.id = bs.booking_id
  LEFT JOIN transactions t ON b.id = t.booking_id AND t.status = 'completed'
  WHERE b.worker_id = p_worker_id
    AND b.tip_amount > 0
    AND (p_start_date IS NULL OR b.scheduled_date >= p_start_date)
    AND (p_end_date IS NULL OR b.scheduled_date <= p_end_date)
  ORDER BY b.scheduled_date DESC;
END;
$$;

-- Function for admin tip analytics
CREATE OR REPLACE FUNCTION get_tip_analytics(
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS TABLE (
  worker_id UUID,
  worker_name TEXT,
  total_bookings BIGINT,
  bookings_with_tips BIGINT,
  tip_percentage NUMERIC,
  total_tips NUMERIC,
  avg_tip NUMERIC,
  max_tip NUMERIC
) 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    b.worker_id,
    u.name as worker_name,
    COUNT(*) as total_bookings,
    COUNT(*) FILTER (WHERE b.tip_amount > 0) as bookings_with_tips,
    ROUND((COUNT(*) FILTER (WHERE b.tip_amount > 0)::NUMERIC / NULLIF(COUNT(*)::NUMERIC, 0)) * 100, 2) as tip_percentage,
    COALESCE(SUM(b.tip_amount), 0) as total_tips,
    COALESCE(AVG(b.tip_amount) FILTER (WHERE b.tip_amount > 0), 0) as avg_tip,
    COALESCE(MAX(b.tip_amount), 0) as max_tip
  FROM bookings b
  INNER JOIN users u ON b.worker_id = u.id
  WHERE b.worker_id IS NOT NULL
    AND (p_start_date IS NULL OR b.scheduled_date >= p_start_date)
    AND (p_end_date IS NULL OR b.scheduled_date <= p_end_date)
  GROUP BY b.worker_id, u.name
  ORDER BY total_tips DESC;
END;
$$;

-- Phase 4: Real-Time Tip Notification Trigger

-- Function to notify worker of new tip
CREATE OR REPLACE FUNCTION notify_worker_tip()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only trigger when payment is completed and there's a tip
  IF NEW.payment_status = 'completed' AND NEW.tip_amount > 0 AND NEW.worker_id IS NOT NULL THEN
    -- Check if notification already exists to prevent duplicates
    IF NOT EXISTS (
      SELECT 1 FROM worker_notifications 
      WHERE worker_id = NEW.worker_id 
        AND body LIKE '%' || NEW.id::TEXT || '%'
        AND created_at > now() - INTERVAL '1 hour'
    ) THEN
      INSERT INTO worker_notifications (
        worker_id,
        title,
        body,
        is_read
      ) VALUES (
        NEW.worker_id,
        'New Tip Received! 🎉',
        'You received a $' || NEW.tip_amount || ' tip for booking ' || NEW.id || '. Great job!',
        false
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger for tip notifications
DROP TRIGGER IF EXISTS tip_notification_trigger ON bookings;
CREATE TRIGGER tip_notification_trigger
AFTER UPDATE ON bookings
FOR EACH ROW
WHEN (NEW.payment_status = 'completed' AND NEW.tip_amount > 0)
EXECUTE FUNCTION notify_worker_tip();

-- RLS Policies for tip data access

-- Workers can view their own tips in bookings
DROP POLICY IF EXISTS "Workers can view own tip bookings" ON bookings;
CREATE POLICY "Workers can view own tip bookings" ON bookings
FOR SELECT
TO authenticated
USING (worker_id = auth.uid() AND tip_amount IS NOT NULL);

-- Create function to refresh materialized view (for periodic updates)
CREATE OR REPLACE FUNCTION refresh_worker_tips_summary()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY worker_tips_summary;
END;
$$;