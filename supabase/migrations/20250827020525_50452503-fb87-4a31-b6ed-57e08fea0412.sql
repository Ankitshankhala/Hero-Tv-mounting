-- Fix for booking failures: Update functions to use proper day_of_week casting
-- This resolves the "cannot cast type numeric to day_of_week" error

-- Update find_available_workers_polygon function to use proper casting
CREATE OR REPLACE FUNCTION public.find_available_workers_polygon(customer_zipcode text, service_date date, service_start_time time without time zone, service_duration_minutes integer DEFAULT 60)
 RETURNS TABLE(worker_id uuid, distance_priority integer, worker_name text, worker_email text)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    u.id as worker_id,
    1 as distance_priority, -- All workers in polygon have same priority
    u.name as worker_name,
    u.email as worker_email
  FROM public.users u
  WHERE u.role = 'worker'
    AND u.is_active = true
    AND EXISTS (
      -- Check if worker has polygon-based service area covering this zip code
      SELECT 1 
      FROM public.worker_service_zipcodes wsz
      INNER JOIN public.worker_service_areas wsa ON wsz.service_area_id = wsa.id
      WHERE wsz.worker_id = u.id 
        AND wsz.zipcode = customer_zipcode
        AND wsa.is_active = true
    )
    AND EXISTS (
      -- Check if worker is available on this day/time - FIX: Use proper day name mapping
      SELECT 1 
      FROM public.worker_availability wa
      WHERE wa.worker_id = u.id
        AND wa.day_of_week = (
          CASE EXTRACT(DOW FROM service_date)::integer
            WHEN 0 THEN 'sunday'::day_of_week
            WHEN 1 THEN 'monday'::day_of_week
            WHEN 2 THEN 'tuesday'::day_of_week
            WHEN 3 THEN 'wednesday'::day_of_week
            WHEN 4 THEN 'thursday'::day_of_week
            WHEN 5 THEN 'friday'::day_of_week
            WHEN 6 THEN 'saturday'::day_of_week
          END
        )
        AND wa.start_time <= service_start_time
        AND wa.end_time >= (service_start_time + (service_duration_minutes || ' minutes')::INTERVAL)::TIME
    )
    AND NOT EXISTS (
      -- Check for conflicting bookings
      SELECT 1 
      FROM public.bookings b
      WHERE b.worker_id = u.id
        AND b.scheduled_date = service_date
        AND b.status IN ('confirmed', 'completed', 'payment_authorized')
        AND (
          (b.scheduled_start <= service_start_time AND 
           (b.scheduled_start + INTERVAL '60 minutes') > service_start_time) OR
          (service_start_time <= b.scheduled_start AND 
           (service_start_time + (service_duration_minutes || ' minutes')::INTERVAL) > b.scheduled_start)
        )
    )
  ORDER BY u.name;
END;
$function$;