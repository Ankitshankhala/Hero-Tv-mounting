-- Drop all existing variants of find_available_workers_by_zip
DROP FUNCTION IF EXISTS public.find_available_workers_by_zip(text, date, time, integer);
DROP FUNCTION IF EXISTS public.find_available_workers_by_zip(text, date, time without time zone, integer);

-- Create canonical version with fixed day_of_week comparison
CREATE OR REPLACE FUNCTION public.find_available_workers_by_zip(
  p_zipcode text,
  p_date date,
  p_time time without time zone,
  p_duration_minutes integer DEFAULT 60
)
RETURNS TABLE(
  worker_id uuid,
  worker_name text,
  worker_email text,
  worker_phone text,
  distance_miles numeric,
  is_available boolean,
  has_conflict boolean
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p_day_name text;
  p_end_time time without time zone;
BEGIN
  -- Get unpadded day name (e.g., "Monday" not "Monday  ")
  p_day_name := to_char(p_date, 'FMDay');
  p_end_time := p_time + (p_duration_minutes || ' minutes')::interval;

  RETURN QUERY
  SELECT DISTINCT
    u.id as worker_id,
    u.name as worker_name,
    u.email as worker_email,
    u.phone as worker_phone,
    0::numeric as distance_miles,
    true as is_available,
    false as has_conflict
  FROM public.users u
  INNER JOIN public.worker_service_zipcodes wsz ON u.id = wsz.worker_id
  INNER JOIN public.worker_service_areas wsa ON wsz.service_area_id = wsa.id
  LEFT JOIN public.worker_availability wa ON u.id = wa.worker_id
  WHERE u.role = 'worker'
    AND u.is_active = true
    AND wsa.is_active = true
    AND wsz.zipcode = p_zipcode
    -- Compare day_of_week using unpadded day name
    AND (wa.id IS NULL OR wa.day_of_week::text = p_day_name)
    -- Check time range overlap if availability exists
    AND (wa.id IS NULL OR (wa.start_time <= p_time AND wa.end_time >= p_end_time))
    -- Exclude workers with conflicting bookings
    AND NOT EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.worker_id = u.id
        AND b.scheduled_date = p_date
        AND b.status NOT IN ('cancelled', 'completed')
        AND b.scheduled_start < p_end_time
        AND (b.scheduled_start + interval '1 hour') > p_time
    );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.find_available_workers_by_zip(text, date, time without time zone, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.find_available_workers_by_zip(text, date, time without time zone, integer) TO anon;
GRANT EXECUTE ON FUNCTION public.find_available_workers_by_zip(text, date, time without time zone, integer) TO service_role;