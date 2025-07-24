-- Fix ambiguous column reference in find_available_workers function
CREATE OR REPLACE FUNCTION public.find_available_workers(
  p_zipcode text,
  p_scheduled_date date,
  p_scheduled_start time without time zone,
  p_duration_minutes integer DEFAULT 60
)
RETURNS TABLE(
  worker_id uuid,
  worker_name text,
  worker_email text,
  worker_phone text,
  distance_priority integer
) AS $$
DECLARE
  target_day_of_week integer;
  service_end_time time without time zone;  -- Renamed from end_time to avoid conflict
BEGIN
  -- Get day of week for the target date (0=Sunday, 1=Monday, etc.)
  target_day_of_week := EXTRACT(DOW FROM p_scheduled_date);
  
  -- Calculate end time for the service
  service_end_time := p_scheduled_start + (p_duration_minutes * INTERVAL '1 minute');
  
  RETURN QUERY
  SELECT DISTINCT
    u.id,
    u.full_name,
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
    wa.day_of_week = target_day_of_week AND
    wa.start_time <= p_scheduled_start AND
    wa.end_time >= service_end_time AND  -- Use qualified column name
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
           b.scheduled_start + (b.total_duration_minutes * INTERVAL '1 minute') > p_scheduled_start)
          OR
          (b.scheduled_start >= p_scheduled_start AND 
           b.scheduled_start < service_end_time)
        )
    )
  ORDER BY distance_priority, u.full_name;
END;
$$ LANGUAGE plpgsql;