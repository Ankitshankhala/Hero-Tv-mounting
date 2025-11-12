-- Performance Optimization Part 2: Admin Dashboard Metrics Function

CREATE OR REPLACE FUNCTION get_admin_dashboard_metrics()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_month_start DATE;
  previous_month_start DATE;
  previous_month_end DATE;
  metrics JSON;
BEGIN
  -- Calculate date ranges
  current_month_start := DATE_TRUNC('month', CURRENT_DATE);
  previous_month_start := DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month');
  previous_month_end := current_month_start - INTERVAL '1 day';

  -- Build metrics JSON
  SELECT json_build_object(
    'totalBookings', (SELECT COUNT(*) FROM bookings),
    'totalRevenue', (
      SELECT COALESCE(SUM(amount), 0) 
      FROM transactions 
      WHERE status IN ('captured', 'completed') 
        AND transaction_type IN ('capture', 'charge')
    ),
    'completedBookings', (SELECT COUNT(*) FROM bookings WHERE status = 'completed'),
    'pendingBookings', (SELECT COUNT(*) FROM bookings WHERE status = 'pending'),
    'activeCustomers', (SELECT COUNT(*) FROM users WHERE role = 'customer' AND is_active = true),
    'activeWorkers', (SELECT COUNT(*) FROM users WHERE role = 'worker' AND is_active = true),
    
    -- Current month metrics
    'bookingsThisMonth', (
      SELECT COUNT(*) 
      FROM bookings 
      WHERE created_at >= current_month_start
    ),
    'revenueThisMonth', (
      SELECT COALESCE(SUM(amount), 0) 
      FROM transactions 
      WHERE status IN ('captured', 'completed') 
        AND transaction_type IN ('capture', 'charge')
        AND created_at >= current_month_start
    ),
    'customersThisMonth', (
      SELECT COUNT(*) 
      FROM users 
      WHERE role = 'customer' 
        AND is_active = true 
        AND created_at >= current_month_start
    ),
    'jobsThisMonth', (
      SELECT COUNT(*) 
      FROM bookings 
      WHERE status = 'completed' 
        AND created_at >= current_month_start
    ),
    
    -- Previous month metrics
    'bookingsLastMonth', (
      SELECT COUNT(*) 
      FROM bookings 
      WHERE created_at >= previous_month_start 
        AND created_at <= previous_month_end
    ),
    'revenueLastMonth', (
      SELECT COALESCE(SUM(amount), 0) 
      FROM transactions 
      WHERE status IN ('captured', 'completed') 
        AND transaction_type IN ('capture', 'charge')
        AND created_at >= previous_month_start 
        AND created_at <= previous_month_end
    ),
    'customersLastMonth', (
      SELECT COUNT(*) 
      FROM users 
      WHERE role = 'customer' 
        AND is_active = true 
        AND created_at >= previous_month_start 
        AND created_at <= previous_month_end
    ),
    'jobsLastMonth', (
      SELECT COUNT(*) 
      FROM bookings 
      WHERE status = 'completed' 
        AND created_at >= previous_month_start 
        AND created_at <= previous_month_end
    ),
    
    -- Average booking value
    'avgBookingValue', (
      SELECT COALESCE(
        ROUND(
          (SELECT SUM(amount) FROM transactions WHERE status IN ('captured', 'completed'))::NUMERIC / 
          NULLIF((SELECT COUNT(*) FROM bookings), 0)::NUMERIC,
          2
        ),
        0
      )
    ),
    
    -- Reviews (currently not tracked, return 0)
    'averageRating', 0,
    'totalReviews', 0
  ) INTO metrics;

  RETURN metrics;
END;
$$;