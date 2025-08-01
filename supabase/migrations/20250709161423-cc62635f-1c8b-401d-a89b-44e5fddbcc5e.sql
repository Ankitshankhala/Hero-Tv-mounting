-- Ensure 7 PM time slot is properly included and fix database function
CREATE OR REPLACE FUNCTION public.get_available_time_slots(p_zipcode text, p_date date, p_service_duration_minutes integer DEFAULT 60)
 RETURNS TABLE(time_slot time without time zone, available_workers integer, worker_ids uuid[])
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  target_day text;
  slot_time time without time zone;
  slot_end_time time without time zone;
  time_slots time without time zone[] := ARRAY['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00']::time[];
  slot time without time zone;
  available_worker_count integer;
  available_worker_ids uuid[];
BEGIN
  -- Get day of week for the target date
  target_day := TRIM(TO_CHAR(p_date, 'Day'));
  
  -- For each time slot, check availability
  FOREACH slot IN ARRAY time_slots
  LOOP
    slot_end_time := slot + (p_service_duration_minutes || ' minutes')::INTERVAL;
    
    -- Skip if slot would end after 20:00 (8 PM)
    IF slot_end_time > '20:00'::time THEN
      CONTINUE;
    END IF;
    
    -- Find workers available for this time slot
    WITH available_workers AS (
      SELECT DISTINCT u.id as worker_id
      FROM public.users u
      WHERE u.role = 'worker'
        AND u.is_active = true
        AND u.zip_code IS NOT NULL
        AND (
          -- Check zipcode proximity (same or nearby)
          u.zip_code = p_zipcode 
          OR LEFT(u.zip_code, 3) = LEFT(p_zipcode, 3)
        )
        -- Check if worker has weekly availability for this day and time
        AND EXISTS (
          SELECT 1 FROM public.worker_availability wa
          WHERE wa.worker_id = u.id
            AND wa.day_of_week::text = target_day
            AND wa.start_time <= slot
            AND wa.end_time >= slot_end_time
        )
        -- Check if worker doesn't have a specific schedule override that conflicts
        AND NOT EXISTS (
          SELECT 1 FROM public.worker_schedule ws
          WHERE ws.worker_id = u.id
            AND ws.work_date = p_date
            AND (
              (ws.start_time <= slot AND ws.end_time > slot)
              OR (slot <= ws.start_time AND slot_end_time > ws.start_time)
            )
        )
        -- Check if worker doesn't have conflicting bookings
        AND NOT EXISTS (
          SELECT 1 FROM public.bookings b
          WHERE b.worker_id = u.id
            AND b.scheduled_date = p_date
            AND b.status NOT IN ('cancelled', 'completed')
            AND (
              (b.scheduled_start <= slot AND 
               b.scheduled_start + INTERVAL '1 hour' > slot) OR
              (slot <= b.scheduled_start AND 
               slot_end_time > b.scheduled_start)
            )
        )
    )
    SELECT 
      COALESCE(COUNT(aw.worker_id), 0)::integer,
      COALESCE(ARRAY_AGG(aw.worker_id), ARRAY[]::uuid[])
    INTO available_worker_count, available_worker_ids
    FROM available_workers aw;
    
    -- Only return slots that have at least one available worker
    IF available_worker_count > 0 THEN
      time_slot := slot;
      available_workers := available_worker_count;
      worker_ids := available_worker_ids;
      RETURN NEXT;
    END IF;
  END LOOP;
  
  RETURN;
END;
$function$;