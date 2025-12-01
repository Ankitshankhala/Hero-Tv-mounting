
-- Drop and recreate the function to update bookings count to only authorized
DROP FUNCTION IF EXISTS get_admin_dashboard_metrics();

CREATE OR REPLACE FUNCTION get_admin_dashboard_metrics()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  current_month_start timestamp with time zone;
  last_month_start timestamp with time zone;
  last_month_end timestamp with time zone;
BEGIN
  -- Calculate date ranges
  current_month_start := date_trunc('month', now());
  last_month_start := date_trunc('month', now() - interval '1 month');
  last_month_end := current_month_start;

  SELECT jsonb_build_object(
    -- Total bookings (all time)
    'totalBookings', (SELECT COUNT(*) FROM bookings),
    
    -- Total revenue from captured transactions
    'totalRevenue', COALESCE((
      SELECT SUM(amount) 
      FROM transactions 
      WHERE status = 'captured'
    ), 0),
    
    -- Average booking value
    'avgBookingValue', COALESCE((
      SELECT AVG(amount) 
      FROM transactions 
      WHERE status = 'captured'
    ), 0),
    
    -- Completed bookings
    'completedBookings', (
      SELECT COUNT(*) 
      FROM bookings 
      WHERE status = 'completed'
    ),
    
    -- Authorized bookings this month (only authorized payments)
    'bookingsThisMonth', (
      SELECT COUNT(*) 
      FROM bookings 
      WHERE created_at >= current_month_start
        AND payment_status = 'authorized'
    ),
    
    -- Authorized bookings last month (only authorized payments)
    'bookingsLastMonth', (
      SELECT COUNT(*) 
      FROM bookings 
      WHERE created_at >= last_month_start 
        AND created_at < last_month_end
        AND payment_status = 'authorized'
    ),
    
    -- Revenue this month
    'revenueThisMonth', COALESCE((
      SELECT SUM(amount) 
      FROM transactions 
      WHERE status = 'captured' 
        AND created_at >= current_month_start
    ), 0),
    
    -- Revenue last month
    'revenueLastMonth', COALESCE((
      SELECT SUM(amount) 
      FROM transactions 
      WHERE status = 'captured' 
        AND created_at >= last_month_start 
        AND created_at < last_month_end
    ), 0),
    
    -- Active customers (with at least one booking)
    'activeCustomers', (
      SELECT COUNT(DISTINCT customer_id) 
      FROM bookings 
      WHERE customer_id IS NOT NULL
    ),
    
    -- Customers this month
    'customersThisMonth', (
      SELECT COUNT(DISTINCT customer_id) 
      FROM bookings 
      WHERE customer_id IS NOT NULL 
        AND created_at >= current_month_start
    ),
    
    -- Customers last month
    'customersLastMonth', (
      SELECT COUNT(DISTINCT customer_id) 
      FROM bookings 
      WHERE customer_id IS NOT NULL 
        AND created_at >= last_month_start 
        AND created_at < last_month_end
    ),
    
    -- Jobs completed this month
    'jobsThisMonth', (
      SELECT COUNT(*) 
      FROM bookings 
      WHERE status = 'completed' 
        AND updated_at >= current_month_start
    ),
    
    -- Jobs completed last month
    'jobsLastMonth', (
      SELECT COUNT(*) 
      FROM bookings 
      WHERE status = 'completed' 
        AND updated_at >= last_month_start 
        AND updated_at < last_month_end
    ),
    
    -- Pending bookings
    'pendingBookings', (
      SELECT COUNT(*) 
      FROM bookings 
      WHERE status IN ('pending', 'confirmed')
    ),
    
    -- Active workers
    'activeWorkers', (
      SELECT COUNT(*) 
      FROM users 
      WHERE role = 'worker' 
        AND is_active = true
    ),
    
    -- Average rating (placeholder - would need reviews table)
    'averageRating', 4.8,
    
    -- Total reviews (placeholder)
    'totalReviews', 0
  ) INTO result;

  RETURN result;
END;
$$;
