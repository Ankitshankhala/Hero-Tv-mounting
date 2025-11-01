-- Create RPC function to get detailed booking information for a worker's tips
CREATE OR REPLACE FUNCTION get_worker_tip_booking_details(
  p_worker_id UUID,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS TABLE (
  booking_id UUID,
  customer_id UUID,
  customer_name TEXT,
  customer_email TEXT,
  tip_amount NUMERIC,
  service_date DATE,
  booking_status TEXT,
  payment_status TEXT,
  payment_intent_id TEXT,
  created_at TIMESTAMPTZ,
  has_duplicate_transactions BOOLEAN
) 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    b.id as booking_id,
    b.customer_id,
    COALESCE(u.name, b.guest_customer_info->>'name', 'Guest Customer') as customer_name,
    COALESCE(u.email, b.guest_customer_info->>'email') as customer_email,
    b.tip_amount,
    b.scheduled_date as service_date,
    b.status::TEXT as booking_status,
    b.payment_status,
    b.payment_intent_id,
    b.created_at,
    -- Check for duplicate transactions
    CASE 
      WHEN (SELECT COUNT(*) FROM transactions t WHERE t.booking_id = b.id AND t.tip_amount > 0) > 1 
      THEN true 
      ELSE false 
    END as has_duplicate_transactions
  FROM bookings b
  LEFT JOIN users u ON b.customer_id = u.id
  WHERE b.worker_id = p_worker_id
    AND b.tip_amount > 0
    AND (p_start_date IS NULL OR b.scheduled_date >= p_start_date)
    AND (p_end_date IS NULL OR b.scheduled_date <= p_end_date)
  ORDER BY b.scheduled_date DESC, b.created_at DESC;
END;
$$;