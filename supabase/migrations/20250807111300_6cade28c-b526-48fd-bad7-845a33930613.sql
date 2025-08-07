-- Create function to find existing pending booking (duplicate detection)
CREATE OR REPLACE FUNCTION find_existing_pending_booking(
  p_customer_id UUID DEFAULT NULL,
  p_guest_email TEXT DEFAULT NULL,
  p_guest_phone TEXT DEFAULT NULL,
  p_scheduled_date DATE DEFAULT NULL,
  p_scheduled_start TIME DEFAULT NULL,
  p_grace_period_minutes INTEGER DEFAULT 30
)
RETURNS TABLE (
  booking_id UUID,
  created_at TIMESTAMPTZ,
  payment_intent_id TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- For authenticated users
  IF p_customer_id IS NOT NULL THEN
    RETURN QUERY
    SELECT 
      b.id as booking_id,
      b.created_at,
      b.payment_intent_id
    FROM bookings b
    WHERE b.customer_id = p_customer_id
      AND b.scheduled_date = p_scheduled_date
      AND b.scheduled_start = p_scheduled_start
      AND b.status = 'payment_pending'
      AND b.created_at > NOW() - (p_grace_period_minutes || ' minutes')::INTERVAL
    ORDER BY b.created_at DESC
    LIMIT 1;
  
  -- For guest users
  ELSIF p_guest_email IS NOT NULL AND p_guest_phone IS NOT NULL THEN
    RETURN QUERY
    SELECT 
      b.id as booking_id,
      b.created_at,
      b.payment_intent_id
    FROM bookings b
    WHERE b.customer_id IS NULL
      AND b.guest_customer_info->>'email' = p_guest_email
      AND b.guest_customer_info->>'phone' = p_guest_phone
      AND b.scheduled_date = p_scheduled_date
      AND b.scheduled_start = p_scheduled_start
      AND b.status = 'payment_pending'
      AND b.created_at > NOW() - (p_grace_period_minutes || ' minutes')::INTERVAL
    ORDER BY b.created_at DESC
    LIMIT 1;
  END IF;
  
  RETURN;
END;
$$;

-- Create function to cleanup expired pending bookings
CREATE OR REPLACE FUNCTION cleanup_expired_pending_bookings(
  p_grace_period_minutes INTEGER DEFAULT 30
)
RETURNS TABLE (
  cleaned_booking_id UUID,
  payment_intent_id TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Return the bookings that will be cleaned up
  RETURN QUERY
  SELECT 
    b.id as cleaned_booking_id,
    b.payment_intent_id
  FROM bookings b
  WHERE b.status = 'payment_pending'
    AND b.created_at < NOW() - (p_grace_period_minutes || ' minutes')::INTERVAL;

  -- Delete expired pending bookings and their related data
  DELETE FROM booking_services 
  WHERE booking_id IN (
    SELECT id FROM bookings 
    WHERE status = 'payment_pending'
      AND created_at < NOW() - (p_grace_period_minutes || ' minutes')::INTERVAL
  );

  DELETE FROM bookings 
  WHERE status = 'payment_pending'
    AND created_at < NOW() - (p_grace_period_minutes || ' minutes')::INTERVAL;
    
  RETURN;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION find_existing_pending_booking TO authenticated;
GRANT EXECUTE ON FUNCTION find_existing_pending_booking TO anon;
GRANT EXECUTE ON FUNCTION cleanup_expired_pending_bookings TO service_role;