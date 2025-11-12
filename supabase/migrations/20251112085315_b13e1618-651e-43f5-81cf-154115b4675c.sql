-- Performance Optimization Part 3: Customer Stats Aggregation Function

CREATE OR REPLACE FUNCTION get_customer_stats(
  search_term TEXT DEFAULT NULL,
  limit_count INT DEFAULT 25,
  offset_count INT DEFAULT 0
)
RETURNS TABLE (
  email TEXT,
  name TEXT,
  phone TEXT,
  city TEXT,
  zipcode TEXT,
  total_bookings BIGINT,
  total_spent NUMERIC,
  last_booking TIMESTAMP WITH TIME ZONE,
  total_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH customer_aggregates AS (
    SELECT
      (guest_customer_info->>'email')::TEXT AS customer_email,
      COALESCE((guest_customer_info->>'name')::TEXT, (guest_customer_info->>'customerName')::TEXT) AS customer_name,
      COALESCE((guest_customer_info->>'phone')::TEXT, (guest_customer_info->>'customerPhone')::TEXT) AS customer_phone,
      (guest_customer_info->>'city')::TEXT AS customer_city,
      (guest_customer_info->>'zipcode')::TEXT AS customer_zipcode,
      COUNT(*) AS booking_count,
      COALESCE(SUM(
        CASE 
          WHEN b.status = 'completed' THEN (
            SELECT COALESCE(SUM(bs.quantity * bs.base_price), 0)
            FROM booking_services bs
            WHERE bs.booking_id = b.id
          )
          ELSE 0
        END
      ), 0) AS spent,
      MAX(b.created_at) AS last_booking_date
    FROM bookings b
    WHERE guest_customer_info IS NOT NULL
      AND (guest_customer_info->>'email') IS NOT NULL
      AND (
        search_term IS NULL 
        OR (guest_customer_info->>'email')::TEXT ILIKE '%' || search_term || '%'
        OR COALESCE((guest_customer_info->>'name')::TEXT, (guest_customer_info->>'customerName')::TEXT) ILIKE '%' || search_term || '%'
      )
    GROUP BY customer_email, customer_name, customer_phone, customer_city, customer_zipcode
  ),
  total AS (
    SELECT COUNT(*) AS total_records FROM customer_aggregates
  )
  SELECT
    ca.customer_email,
    COALESCE(ca.customer_name, 'Unknown'),
    ca.customer_phone,
    ca.customer_city,
    ca.customer_zipcode,
    ca.booking_count,
    ca.spent,
    ca.last_booking_date,
    t.total_records
  FROM customer_aggregates ca
  CROSS JOIN total t
  ORDER BY ca.last_booking_date DESC NULLS LAST
  LIMIT limit_count
  OFFSET offset_count;
END;
$$;