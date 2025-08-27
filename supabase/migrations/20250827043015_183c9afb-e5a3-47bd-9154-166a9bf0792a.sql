-- Complete scheduling unification implementation

-- 1. Add unique indexes to prevent overlaps
CREATE UNIQUE INDEX IF NOT EXISTS idx_worker_availability_unique 
ON public.worker_availability (worker_id, day_of_week);

CREATE UNIQUE INDEX IF NOT EXISTS idx_worker_schedule_unique 
ON public.worker_schedule (worker_id, work_date);

-- 2. Add validation triggers for worker_availability
CREATE OR REPLACE FUNCTION public.validate_worker_availability()
RETURNS TRIGGER AS $$
BEGIN
  -- Validate time range
  IF NEW.start_time >= NEW.end_time THEN
    RAISE EXCEPTION 'Start time must be before end time';
  END IF;
  
  -- Validate worker exists and is active
  IF NOT EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = NEW.worker_id AND role = 'worker' AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Worker not found or inactive';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_validate_worker_availability
  BEFORE INSERT OR UPDATE ON public.worker_availability
  FOR EACH ROW EXECUTE FUNCTION public.validate_worker_availability();

-- 3. Add validation triggers for worker_schedule  
CREATE OR REPLACE FUNCTION public.validate_worker_schedule()
RETURNS TRIGGER AS $$
BEGIN
  -- Validate time range
  IF NEW.start_time >= NEW.end_time THEN
    RAISE EXCEPTION 'Start time must be before end time';
  END IF;
  
  -- Validate worker exists and is active
  IF NOT EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = NEW.worker_id AND role = 'worker' AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Worker not found or inactive';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_validate_worker_schedule
  BEFORE INSERT OR UPDATE ON public.worker_schedule
  FOR EACH ROW EXECUTE FUNCTION public.validate_worker_schedule();

-- 4. Create get_worker_weekly_availability function
CREATE OR REPLACE FUNCTION public.get_worker_weekly_availability(p_worker_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  result jsonb := '{}'::jsonb;
  availability_record RECORD;
BEGIN
  -- Verify the worker exists
  IF NOT EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = p_worker_id AND role = 'worker' AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Worker not found or inactive';
  END IF;
  
  -- Build the weekly availability JSON
  FOR availability_record IN 
    SELECT day_of_week, start_time, end_time
    FROM public.worker_availability 
    WHERE worker_id = p_worker_id
    ORDER BY day_of_week
  LOOP
    result := jsonb_set(
      result,
      ARRAY[availability_record.day_of_week::text],
      jsonb_build_object(
        'enabled', true,
        'start_time', availability_record.start_time::text,
        'end_time', availability_record.end_time::text
      )
    );
  END LOOP;
  
  -- Fill in missing days as disabled
  IF NOT (result ? 'Sunday') THEN
    result := jsonb_set(result, '{Sunday}', '{"enabled": false, "start_time": "08:00", "end_time": "18:00"}'::jsonb);
  END IF;
  IF NOT (result ? 'Monday') THEN
    result := jsonb_set(result, '{Monday}', '{"enabled": false, "start_time": "08:00", "end_time": "18:00"}'::jsonb);
  END IF;
  IF NOT (result ? 'Tuesday') THEN
    result := jsonb_set(result, '{Tuesday}', '{"enabled": false, "start_time": "08:00", "end_time": "18:00"}'::jsonb);
  END IF;
  IF NOT (result ? 'Wednesday') THEN
    result := jsonb_set(result, '{Wednesday}', '{"enabled": false, "start_time": "08:00", "end_time": "18:00"}'::jsonb);
  END IF;
  IF NOT (result ? 'Thursday') THEN
    result := jsonb_set(result, '{Thursday}', '{"enabled": false, "start_time": "08:00", "end_time": "18:00"}'::jsonb);
  END IF;
  IF NOT (result ? 'Friday') THEN
    result := jsonb_set(result, '{Friday}', '{"enabled": false, "start_time": "08:00", "end_time": "18:00"}'::jsonb);
  END IF;
  IF NOT (result ? 'Saturday') THEN
    result := jsonb_set(result, '{Saturday}', '{"enabled": false, "start_time": "08:00", "end_time": "18:00"}'::jsonb);
  END IF;
  
  RETURN result;
END;
$function$;

-- 5. Create import_application_availability function
CREATE OR REPLACE FUNCTION public.import_application_availability(p_worker_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  app_availability jsonb;
  day_data jsonb;
  day_name text;
  proper_day_name day_of_week;
BEGIN
  -- Get the worker's application availability
  SELECT availability INTO app_availability
  FROM public.worker_applications wa
  INNER JOIN public.users u ON u.email = wa.email
  WHERE u.id = p_worker_id
    AND wa.status = 'approved'
  LIMIT 1;
  
  IF app_availability IS NULL THEN
    RAISE NOTICE 'No approved application found for worker %', p_worker_id;
    RETURN false;
  END IF;
  
  -- Clear existing availability for this worker
  DELETE FROM public.worker_availability WHERE worker_id = p_worker_id;
  
  -- Import availability data
  FOR day_name IN SELECT jsonb_object_keys(app_availability)
  LOOP
    day_data := app_availability->day_name;
    
    -- Only insert if the day is enabled and has valid times
    IF (day_data->>'enabled')::boolean = true 
       AND day_data->>'startTime' IS NOT NULL 
       AND day_data->>'endTime' IS NOT NULL THEN
      
      -- Map day names properly to enum values (handle both camelCase and snake_case)
      proper_day_name := CASE LOWER(day_name)
        WHEN 'sunday' THEN 'Sunday'::day_of_week
        WHEN 'monday' THEN 'Monday'::day_of_week  
        WHEN 'tuesday' THEN 'Tuesday'::day_of_week
        WHEN 'wednesday' THEN 'Wednesday'::day_of_week
        WHEN 'thursday' THEN 'Thursday'::day_of_week
        WHEN 'friday' THEN 'Friday'::day_of_week
        WHEN 'saturday' THEN 'Saturday'::day_of_week
        ELSE NULL
      END;
      
      IF proper_day_name IS NOT NULL THEN
        INSERT INTO public.worker_availability (
          worker_id, 
          day_of_week, 
          start_time, 
          end_time
        ) VALUES (
          p_worker_id,
          proper_day_name,
          COALESCE((day_data->>'startTime')::time, (day_data->>'start_time')::time),
          COALESCE((day_data->>'endTime')::time, (day_data->>'end_time')::time)
        );
      END IF;
    END IF;
  END LOOP;
  
  -- Log the import
  INSERT INTO public.sms_logs (booking_id, recipient_number, message, status, error_message)
  VALUES (NULL, 'system', 'Imported availability from application for worker ' || p_worker_id, 'sent', NULL);
  
  RETURN true;
END;
$function$;

-- 6. Create backfill function for existing approved workers
CREATE OR REPLACE FUNCTION public.backfill_worker_availability_from_applications()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  worker_record RECORD;
  import_count INTEGER := 0;
  error_count INTEGER := 0;
  result jsonb;
BEGIN
  -- Find all approved workers who don't have availability set yet
  FOR worker_record IN
    SELECT DISTINCT u.id as worker_id, wa.email, wa.availability
    FROM public.worker_applications wa
    INNER JOIN public.users u ON u.email = wa.email
    WHERE wa.status = 'approved'
      AND u.role = 'worker'
      AND u.is_active = true
      AND NOT EXISTS (
        SELECT 1 FROM public.worker_availability wv 
        WHERE wv.worker_id = u.id
      )
  LOOP
    BEGIN
      -- Import availability for this worker
      IF public.import_application_availability(worker_record.worker_id) THEN
        import_count := import_count + 1;
      END IF;
      
    EXCEPTION WHEN OTHERS THEN
      error_count := error_count + 1;
      
      -- Log the error
      INSERT INTO public.sms_logs (booking_id, recipient_number, message, status, error_message)
      VALUES (NULL, 'system', 'Failed to import availability for worker ' || worker_record.worker_id, 'failed', SQLERRM);
    END;
  END LOOP;
  
  -- Build result
  result := jsonb_build_object(
    'imported_count', import_count,
    'error_count', error_count,
    'message', 'Backfill completed: ' || import_count || ' imported, ' || error_count || ' errors'
  );
  
  -- Log the backfill completion
  INSERT INTO public.sms_logs (booking_id, recipient_number, message, status, error_message)
  VALUES (NULL, 'system', result->>'message', 'sent', NULL);
  
  RETURN result;
END;
$function$;

-- 7. Update set_worker_weekly_availability to handle proper day names
CREATE OR REPLACE FUNCTION public.set_worker_weekly_availability(p_worker_id uuid, p_availability jsonb)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  day_data jsonb;
  day_name text;
  proper_day_name day_of_week;
BEGIN
  -- Verify the worker exists and is active
  IF NOT EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = p_worker_id AND role = 'worker' AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Worker not found or inactive';
  END IF;
  
  -- Clear existing availability for this worker
  DELETE FROM public.worker_availability WHERE worker_id = p_worker_id;
  
  -- Insert new availability data
  FOR day_name IN SELECT jsonb_object_keys(p_availability)
  LOOP
    day_data := p_availability->day_name;
    
    -- Only insert if the day is enabled and has valid times
    IF (day_data->>'enabled')::boolean = true 
       AND day_data->>'start_time' IS NOT NULL 
       AND day_data->>'end_time' IS NOT NULL THEN
      
      -- Map day names properly to enum values (handle both cases)
      proper_day_name := CASE LOWER(day_name)
        WHEN 'sunday' THEN 'Sunday'::day_of_week
        WHEN 'monday' THEN 'Monday'::day_of_week  
        WHEN 'tuesday' THEN 'Tuesday'::day_of_week
        WHEN 'wednesday' THEN 'Wednesday'::day_of_week
        WHEN 'thursday' THEN 'Thursday'::day_of_week
        WHEN 'friday' THEN 'Friday'::day_of_week
        WHEN 'saturday' THEN 'Saturday'::day_of_week
        ELSE NULL
      END;
      
      IF proper_day_name IS NOT NULL THEN
        INSERT INTO public.worker_availability (
          worker_id, 
          day_of_week, 
          start_time, 
          end_time
        ) VALUES (
          p_worker_id,
          proper_day_name,
          (day_data->>'start_time')::time,
          (day_data->>'end_time')::time
        );
      END IF;
    END IF;
  END LOOP;
  
  RETURN true;
END;
$function$;