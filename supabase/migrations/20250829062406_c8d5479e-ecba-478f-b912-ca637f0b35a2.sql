-- Add is_available column to worker_schedule table
ALTER TABLE public.worker_schedule 
ADD COLUMN is_available boolean NOT NULL DEFAULT true;

-- Update the find_available_workers_by_zip function to respect date-specific schedule
CREATE OR REPLACE FUNCTION public.find_available_workers_by_zip(
  p_customer_zipcode text, 
  p_date date, 
  p_time time without time zone, 
  p_duration_minutes integer DEFAULT 60
)
RETURNS TABLE(worker_id uuid, distance_priority integer, available_slots integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT DISTINCT
    u.id as worker_id,
    1 as distance_priority, -- All ZIP matches have same priority
    5 as available_slots   -- Simplified for now
  FROM users u
  INNER JOIN worker_service_zipcodes wsz ON u.id = wsz.worker_id
  INNER JOIN worker_service_areas wsa ON wsz.service_area_id = wsa.id
  WHERE u.role = 'worker'
    AND u.is_active = true
    AND wsa.is_active = true
    AND wsz.zipcode = p_customer_zipcode
    -- Check worker's weekly availability for the requested time
    AND EXISTS (
      SELECT 1 FROM worker_availability wa
      WHERE wa.worker_id = u.id
        AND wa.day_of_week = EXTRACT(DOW FROM p_date)::day_of_week
        AND wa.start_time <= p_time
        AND wa.end_time >= (p_time + (p_duration_minutes || ' minutes')::INTERVAL)::TIME
    )
    -- Check worker is NOT marked unavailable on this specific date/time
    AND NOT EXISTS (
      SELECT 1 FROM worker_schedule ws
      WHERE ws.worker_id = u.id
        AND ws.work_date = p_date
        AND ws.is_available = false
        AND ws.start_time <= p_time
        AND ws.end_time >= (p_time + (p_duration_minutes || ' minutes')::INTERVAL)::TIME
    )
    -- Ensure worker is not already booked at this time
    AND NOT EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.worker_id = u.id
        AND b.scheduled_date = p_date
        AND b.scheduled_start < (p_time + (p_duration_minutes || ' minutes')::INTERVAL)::TIME
        AND (b.scheduled_start + INTERVAL '1 hour') > p_time -- Assuming 1hr default duration for existing bookings
        AND b.status NOT IN ('cancelled', 'failed')
    )
  ORDER BY u.created_at; -- FIFO for fairness
END;
$function$;