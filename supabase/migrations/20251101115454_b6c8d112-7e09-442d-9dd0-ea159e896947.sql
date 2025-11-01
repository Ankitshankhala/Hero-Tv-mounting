-- Update get_tip_analytics to show only captured tips from non-admin customers
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
    COUNT(*) FILTER (WHERE b.tip_amount > 0 AND b.payment_status = 'captured') as bookings_with_tips,
    ROUND((COUNT(*) FILTER (WHERE b.tip_amount > 0 AND b.payment_status = 'captured')::NUMERIC / NULLIF(COUNT(*)::NUMERIC, 0)) * 100, 2) as tip_percentage,
    COALESCE(SUM(b.tip_amount) FILTER (WHERE b.payment_status = 'captured'), 0) as total_tips,
    COALESCE(AVG(b.tip_amount) FILTER (WHERE b.tip_amount > 0 AND b.payment_status = 'captured'), 0) as avg_tip,
    COALESCE(MAX(b.tip_amount) FILTER (WHERE b.payment_status = 'captured'), 0) as max_tip
  FROM bookings b
  INNER JOIN users u ON b.worker_id = u.id
  LEFT JOIN users customer ON b.customer_id = customer.id
  WHERE b.worker_id IS NOT NULL
    AND (p_start_date IS NULL OR b.scheduled_date >= p_start_date)
    AND (p_end_date IS NULL OR b.scheduled_date <= p_end_date)
    AND (customer.role IS NULL OR customer.role != 'admin')
  GROUP BY b.worker_id, u.name
  ORDER BY total_tips DESC;
END;
$$;

-- Update get_worker_tip_booking_details to show only captured tips from non-admin customers
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
    CASE 
      WHEN (SELECT COUNT(*) FROM transactions t WHERE t.booking_id = b.id AND t.tip_amount > 0) > 1 
      THEN true 
      ELSE false 
    END as has_duplicate_transactions
  FROM bookings b
  LEFT JOIN users u ON b.customer_id = u.id
  WHERE b.worker_id = p_worker_id
    AND b.tip_amount > 0
    AND b.payment_status = 'captured'
    AND (p_start_date IS NULL OR b.scheduled_date >= p_start_date)
    AND (p_end_date IS NULL OR b.scheduled_date <= p_end_date)
    AND (u.role IS NULL OR u.role != 'admin')
  ORDER BY b.scheduled_date DESC, b.created_at DESC;
END;
$$;