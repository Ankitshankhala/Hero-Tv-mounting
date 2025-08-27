-- Fix day name mapping in set_worker_weekly_availability function
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
      
      -- Map day names properly to enum values
      proper_day_name := CASE LOWER(day_name)
        WHEN 'sunday' THEN 'sunday'::day_of_week
        WHEN 'monday' THEN 'monday'::day_of_week  
        WHEN 'tuesday' THEN 'tuesday'::day_of_week
        WHEN 'wednesday' THEN 'wednesday'::day_of_week
        WHEN 'thursday' THEN 'thursday'::day_of_week
        WHEN 'friday' THEN 'friday'::day_of_week
        WHEN 'saturday' THEN 'saturday'::day_of_week
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