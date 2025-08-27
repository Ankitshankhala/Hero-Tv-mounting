-- Fix day_of_week casing mismatch in find_available_workers_polygon function
CREATE OR REPLACE FUNCTION public.find_available_workers_polygon(
  customer_zipcode text,
  booking_date date,
  booking_time time,
  duration_minutes integer DEFAULT 60
)
RETURNS TABLE(worker_id uuid, distance_priority integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  booking_day_name text;
  booking_end_time time;
BEGIN
  -- Get the day name for the booking date with proper casing
  SELECT INITCAP(TO_CHAR(booking_date, 'Day')) INTO booking_day_name;
  booking_day_name := TRIM(booking_day_name);
  
  -- Calculate booking end time
  booking_end_time := booking_time + (duration_minutes || ' minutes')::INTERVAL;
  
  RETURN QUERY
  SELECT DISTINCT 
    u.id as worker_id,
    1 as distance_priority -- All polygon matches get same priority
  FROM users u
  INNER JOIN worker_service_areas wsa ON u.id = wsa.worker_id
  INNER JOIN worker_service_zipcodes wsz ON wsa.id = wsz.service_area_id
  INNER JOIN worker_availability wa ON u.id = wa.worker_id
  WHERE u.role = 'worker'
    AND u.is_active = true
    AND wsa.is_active = true
    AND wsz.zipcode = customer_zipcode
    AND wa.day_of_week::text = booking_day_name
    AND wa.start_time <= booking_time
    AND wa.end_time >= booking_end_time
    AND NOT EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.worker_id = u.id
        AND b.scheduled_date = booking_date
        AND b.scheduled_start < booking_end_time
        AND (b.scheduled_start + INTERVAL '1 hour') > booking_time
        AND b.status NOT IN ('cancelled', 'failed')
    );
END;
$function$;