-- Fix the find_available_workers function with proper type casting
CREATE OR REPLACE FUNCTION public.find_available_workers(p_zipcode text, p_scheduled_date date, p_scheduled_start time without time zone, p_duration_minutes integer DEFAULT 60)
 RETURNS TABLE(worker_id uuid, worker_name text, worker_email text, worker_phone text, distance_priority integer)
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  target_day_of_week integer;
  service_end_time time without time zone;
BEGIN
  -- Get day of week for the target date (0=Sunday, 1=Monday, etc.)
  target_day_of_week := EXTRACT(DOW FROM p_scheduled_date);
  
  -- Calculate end time for the service
  service_end_time := p_scheduled_start + (p_duration_minutes * INTERVAL '1 minute');
  
  RETURN QUERY
  SELECT DISTINCT
    u.id,
    u.name, -- Fixed: was u.full_name, now using u.name
    u.email,
    u.phone,
    CASE 
      WHEN u.zip_code = p_zipcode THEN 1
      WHEN LEFT(u.zip_code, 3) = LEFT(p_zipcode, 3) THEN 2
      ELSE 3
    END as distance_priority
  FROM public.users u
  JOIN public.worker_availability wa ON wa.worker_id = u.id
  WHERE 
    u.role = 'worker' AND
    u.is_active = true AND
    u.zip_code IS NOT NULL AND
    (
      -- Check zipcode proximity (same or nearby)
      u.zip_code = p_zipcode 
      OR LEFT(u.zip_code, 3) = LEFT(p_zipcode, 3)
    ) AND
    -- Fix: Cast enum to text and compare with day name instead of number
    wa.day_of_week::text = CASE target_day_of_week
      WHEN 0 THEN 'Sunday'
      WHEN 1 THEN 'Monday'
      WHEN 2 THEN 'Tuesday'
      WHEN 3 THEN 'Wednesday'
      WHEN 4 THEN 'Thursday'
      WHEN 5 THEN 'Friday'
      WHEN 6 THEN 'Saturday'
    END AND
    wa.start_time <= p_scheduled_start AND
    wa.end_time >= service_end_time AND
    NOT EXISTS (
      -- Check if worker already has a booking during this time
      SELECT 1
      FROM public.bookings b
      WHERE 
        b.worker_id = u.id AND
        b.status IN ('confirmed', 'in_progress') AND
        b.scheduled_date = p_scheduled_date AND
        (
          (b.scheduled_start <= p_scheduled_start AND 
           b.scheduled_start + INTERVAL '1 hour' > p_scheduled_start)
          OR
          (b.scheduled_start >= p_scheduled_start AND 
           b.scheduled_start < service_end_time)
        )
    )
  ORDER BY distance_priority, u.name; -- Fixed: was u.full_name, now using u.name
END;
$function$;