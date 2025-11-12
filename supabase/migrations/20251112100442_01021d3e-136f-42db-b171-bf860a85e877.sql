-- Phase 1: Update find_available_workers_by_zip to check worker_schedule table
DROP FUNCTION IF EXISTS public.find_available_workers_by_zip(text, date, time without time zone, integer);

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
    
    -- Check weekly recurring availability
    AND (wa.id IS NULL OR wa.day_of_week::text = p_day_name)
    AND (wa.id IS NULL OR (wa.start_time <= p_time AND wa.end_time >= p_end_time))
    
    -- NEW: Check date-specific schedule availability
    AND NOT EXISTS (
      SELECT 1 FROM public.worker_schedule ws
      WHERE ws.worker_id = u.id
        AND ws.work_date = p_date
        AND ws.is_available = false
        AND ws.start_time < p_end_time
        AND ws.end_time > p_time
    )
    
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

-- Phase 2: Create validation function for reuse across the system
CREATE OR REPLACE FUNCTION public.validate_worker_booking_assignment(
  p_worker_id uuid,
  p_booking_date date,
  p_booking_time time without time zone,
  p_duration_minutes integer DEFAULT 60
)
RETURNS TABLE(
  is_valid boolean,
  error_message text,
  error_code text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_day_name text;
  v_end_time time without time zone;
  v_has_availability boolean;
  v_has_schedule_block boolean;
  v_has_conflict boolean;
  v_is_active boolean;
BEGIN
  v_day_name := to_char(p_booking_date, 'FMDay');
  v_end_time := p_booking_time + (p_duration_minutes || ' minutes')::interval;

  -- Check if worker is active
  SELECT is_active INTO v_is_active
  FROM public.users
  WHERE id = p_worker_id AND role = 'worker';
  
  IF NOT FOUND OR NOT v_is_active THEN
    RETURN QUERY SELECT false, 'Worker is not active or does not exist'::text, 'WORKER_INACTIVE'::text;
    RETURN;
  END IF;

  -- Check weekly availability
  SELECT EXISTS(
    SELECT 1 FROM public.worker_availability wa
    WHERE wa.worker_id = p_worker_id
      AND wa.day_of_week::text = v_day_name
      AND wa.start_time <= p_booking_time
      AND wa.end_time >= v_end_time
  ) INTO v_has_availability;

  IF NOT v_has_availability THEN
    RETURN QUERY SELECT false, 
      'Worker is not available during this time slot based on their weekly schedule'::text, 
      'WEEKLY_UNAVAILABLE'::text;
    RETURN;
  END IF;

  -- Check date-specific schedule blocks (is_available = false)
  SELECT EXISTS(
    SELECT 1 FROM public.worker_schedule ws
    WHERE ws.worker_id = p_worker_id
      AND ws.work_date = p_booking_date
      AND ws.is_available = false
      AND ws.start_time < v_end_time
      AND ws.end_time > p_booking_time
  ) INTO v_has_schedule_block;

  IF v_has_schedule_block THEN
    RETURN QUERY SELECT false,
      'Worker has marked themselves unavailable on this specific date and time'::text,
      'DATE_UNAVAILABLE'::text;
    RETURN;
  END IF;

  -- Check for booking conflicts
  SELECT EXISTS(
    SELECT 1 FROM public.bookings b
    WHERE b.worker_id = p_worker_id
      AND b.scheduled_date = p_booking_date
      AND b.status NOT IN ('cancelled', 'completed')
      AND b.scheduled_start < v_end_time
      AND (b.scheduled_start + interval '1 hour') > p_booking_time
  ) INTO v_has_conflict;

  IF v_has_conflict THEN
    RETURN QUERY SELECT false,
      'Worker already has a conflicting booking at this time'::text,
      'BOOKING_CONFLICT'::text;
    RETURN;
  END IF;

  -- All checks passed
  RETURN QUERY SELECT true, 'Worker is available'::text, 'AVAILABLE'::text;
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_worker_booking_assignment TO authenticated, anon, service_role;

-- Phase 3: Create trigger function to prevent invalid worker assignments
CREATE OR REPLACE FUNCTION public.prevent_invalid_worker_assignment()
RETURNS TRIGGER AS $$
DECLARE
  v_validation_result RECORD;
BEGIN
  -- Only validate if worker_id is being set
  IF NEW.worker_id IS NOT NULL AND (TG_OP = 'INSERT' OR OLD.worker_id IS DISTINCT FROM NEW.worker_id) THEN
    
    -- Run validation
    SELECT * INTO v_validation_result
    FROM public.validate_worker_booking_assignment(
      NEW.worker_id,
      NEW.scheduled_date,
      NEW.scheduled_start,
      60 -- Default duration
    )
    LIMIT 1;

    -- If validation fails, prevent the assignment
    IF NOT v_validation_result.is_valid THEN
      RAISE EXCEPTION 'Cannot assign worker to booking: % (Code: %)', 
        v_validation_result.error_message,
        v_validation_result.error_code
        USING HINT = 'Please select a different worker or time slot';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger (but disabled by default to not break existing functionality)
DROP TRIGGER IF EXISTS trigger_validate_worker_assignment ON public.bookings;
CREATE TRIGGER trigger_validate_worker_assignment
  BEFORE INSERT OR UPDATE OF worker_id ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_invalid_worker_assignment();

-- Initially disable the trigger to allow gradual rollout
ALTER TABLE public.bookings DISABLE TRIGGER trigger_validate_worker_assignment;

COMMENT ON TRIGGER trigger_validate_worker_assignment ON public.bookings IS 
'Validates worker availability before assignment. Disabled by default for gradual rollout.';