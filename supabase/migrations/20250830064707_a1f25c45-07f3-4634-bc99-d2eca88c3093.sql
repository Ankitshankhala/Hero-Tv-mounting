-- Add missing RPC helper for finding available workers by zipcode (used by create-guest-booking)
CREATE OR REPLACE FUNCTION public.find_available_workers_by_zip(
  p_zipcode TEXT,
  p_date DATE,
  p_time TIME,
  p_duration_minutes INTEGER DEFAULT 60
)
RETURNS TABLE (
  worker_id UUID,
  distance_priority INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Return workers with strict ZIP coverage (no fallback)
  RETURN QUERY
  SELECT 
    wsz.worker_id,
    1 as distance_priority
  FROM worker_service_zipcodes wsz
  INNER JOIN worker_service_areas wsa ON wsz.service_area_id = wsa.id
  INNER JOIN users u ON wsa.worker_id = u.id
  WHERE wsz.zipcode = p_zipcode
    AND wsa.is_active = true
    AND u.role = 'worker'
    AND u.is_active = true
    -- Check availability for the requested time
    AND EXISTS (
      SELECT 1 FROM worker_availability wa
      WHERE wa.worker_id = wsz.worker_id
        AND wa.day_of_week = to_char(p_date, 'Day')::day_of_week
        AND wa.start_time <= p_time
        AND wa.end_time >= (p_time + (p_duration_minutes || ' minutes')::INTERVAL)::TIME
    )
    -- Ensure no conflicting bookings
    AND NOT EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.worker_id = wsz.worker_id
        AND b.scheduled_date = p_date
        AND b.status NOT IN ('cancelled', 'failed')
        AND (
          (b.scheduled_start, (b.scheduled_start + '60 minutes'::INTERVAL)::TIME) 
          OVERLAPS 
          (p_time, (p_time + (p_duration_minutes || ' minutes')::INTERVAL)::TIME)
        )
    )
  ORDER BY wsz.worker_id
  LIMIT 10;
END;
$function$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION find_available_workers_by_zip TO authenticated;
GRANT EXECUTE ON FUNCTION find_available_workers_by_zip TO anon;
GRANT EXECUTE ON FUNCTION find_available_workers_by_zip TO service_role;