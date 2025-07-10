-- Fix ambiguous column reference in find_available_workers function
CREATE OR REPLACE FUNCTION public.find_available_workers(
  p_zipcode text,
  p_scheduled_date date,
  p_scheduled_start time without time zone,
  p_duration_minutes integer DEFAULT 60
)
RETURNS TABLE(worker_id uuid, worker_name text, worker_email text, worker_phone text, distance_priority integer)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  target_day TEXT;
  end_time TIME;
BEGIN
  -- Get day of week for the scheduled date
  target_day := TO_CHAR(p_scheduled_date, 'Day');
  target_day := TRIM(target_day);
  
  -- Calculate end time
  end_time := p_scheduled_start + (p_duration_minutes || ' minutes')::INTERVAL;
  
  RETURN QUERY
  SELECT 
    u.id as worker_id,
    u.name as worker_name,
    u.email as worker_email,
    u.phone as worker_phone,
    CASE 
      WHEN u.zip_code = p_zipcode THEN 1
      WHEN LEFT(u.zip_code, 3) = LEFT(p_zipcode, 3) THEN 2
      ELSE 3
    END as distance_priority
  FROM public.users u
  WHERE 
    u.role = 'worker'
    AND u.is_active = true
    AND u.zip_code IS NOT NULL
    -- Check if worker has weekly availability for this day and time
    AND EXISTS (
      SELECT 1 FROM public.worker_availability wa
      WHERE wa.worker_id = u.id
      AND wa.day_of_week::TEXT = target_day
      AND wa.start_time <= p_scheduled_start
      AND wa.end_time >= end_time
    )
    -- Check if worker doesn't have conflicting bookings
    AND NOT EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.worker_id = u.id
      AND b.scheduled_date = p_scheduled_date
      AND b.status NOT IN ('cancelled', 'completed')
      AND (
        (b.scheduled_start <= p_scheduled_start AND 
         b.scheduled_start + INTERVAL '1 hour' > p_scheduled_start) OR
        (p_scheduled_start <= b.scheduled_start AND 
         end_time > b.scheduled_start)
      )
    )
  ORDER BY 
    CASE 
      WHEN u.zip_code = p_zipcode THEN 1
      WHEN LEFT(u.zip_code, 3) = LEFT(p_zipcode, 3) THEN 2
      ELSE 3
    END, 
    u.created_at;
END;
$function$;

-- Set up worker availability for existing workers to enable testing
-- Connor Perrin (worker in 75001)
INSERT INTO public.worker_availability (worker_id, day_of_week, start_time, end_time)
SELECT 
  id as worker_id,
  'Monday'::day_of_week as day_of_week,
  '08:00'::time as start_time,
  '18:00'::time as end_time
FROM public.users 
WHERE email = 'connor.perrin@example.com' AND role = 'worker'
ON CONFLICT DO NOTHING;

INSERT INTO public.worker_availability (worker_id, day_of_week, start_time, end_time)
SELECT 
  id as worker_id,
  'Tuesday'::day_of_week as day_of_week,
  '08:00'::time as start_time,
  '18:00'::time as end_time
FROM public.users 
WHERE email = 'connor.perrin@example.com' AND role = 'worker'
ON CONFLICT DO NOTHING;

INSERT INTO public.worker_availability (worker_id, day_of_week, start_time, end_time)
SELECT 
  id as worker_id,
  'Wednesday'::day_of_week as day_of_week,
  '08:00'::time as start_time,
  '18:00'::time as end_time
FROM public.users 
WHERE email = 'connor.perrin@example.com' AND role = 'worker'
ON CONFLICT DO NOTHING;

INSERT INTO public.worker_availability (worker_id, day_of_week, start_time, end_time)
SELECT 
  id as worker_id,
  'Thursday'::day_of_week as day_of_week,
  '08:00'::time as start_time,
  '18:00'::time as end_time
FROM public.users 
WHERE email = 'connor.perrin@example.com' AND role = 'worker'
ON CONFLICT DO NOTHING;

INSERT INTO public.worker_availability (worker_id, day_of_week, start_time, end_time)
SELECT 
  id as worker_id,
  'Friday'::day_of_week as day_of_week,
  '08:00'::time as start_time,
  '18:00'::time as end_time
FROM public.users 
WHERE email = 'connor.perrin@example.com' AND role = 'worker'
ON CONFLICT DO NOTHING;

-- Create additional test workers in the same ZIP code area for testing multi-worker assignment
INSERT INTO public.users (id, email, name, phone, city, zip_code, role, is_active)
VALUES 
  ('11111111-1111-1111-1111-111111111111', 'worker2@test.com', 'Test Worker 2', '+15551234568', 'Plano', '75001', 'worker', true),
  ('22222222-2222-2222-2222-222222222222', 'worker3@test.com', 'Test Worker 3', '+15551234569', 'Plano', '75002', 'worker', true)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  city = EXCLUDED.city,
  zip_code = EXCLUDED.zip_code,
  role = EXCLUDED.role,
  is_active = EXCLUDED.is_active;

-- Set up availability for Test Worker 2 (same ZIP as Connor)
INSERT INTO public.worker_availability (worker_id, day_of_week, start_time, end_time)
VALUES 
  ('11111111-1111-1111-1111-111111111111', 'Monday', '08:00', '18:00'),
  ('11111111-1111-1111-1111-111111111111', 'Tuesday', '08:00', '18:00'),
  ('11111111-1111-1111-1111-111111111111', 'Wednesday', '08:00', '18:00'),
  ('11111111-1111-1111-1111-111111111111', 'Thursday', '08:00', '18:00'),
  ('11111111-1111-1111-1111-111111111111', 'Friday', '08:00', '18:00')
ON CONFLICT DO NOTHING;

-- Set up availability for Test Worker 3 (nearby ZIP)
INSERT INTO public.worker_availability (worker_id, day_of_week, start_time, end_time)
VALUES 
  ('22222222-2222-2222-2222-222222222222', 'Monday', '09:00', '17:00'),
  ('22222222-2222-2222-2222-222222222222', 'Tuesday', '09:00', '17:00'),
  ('22222222-2222-2222-2222-222222222222', 'Wednesday', '09:00', '17:00'),
  ('22222222-2222-2222-2222-222222222222', 'Thursday', '09:00', '17:00'),
  ('22222222-2222-2222-2222-222222222222', 'Friday', '09:00', '17:00')
ON CONFLICT DO NOTHING;

-- Create a trigger to ensure automatic worker assignment when bookings are created
CREATE OR REPLACE FUNCTION public.auto_assign_worker_on_booking()
RETURNS TRIGGER AS $$
DECLARE
  available_worker_id UUID;
BEGIN
  -- Only try to assign if no worker is already assigned and status is pending
  IF NEW.worker_id IS NULL AND NEW.status = 'pending' THEN
    -- Get the customer's zipcode for the booking
    SELECT worker_id INTO available_worker_id
    FROM find_available_workers(
      (SELECT zip_code FROM users WHERE id = NEW.customer_id),
      NEW.scheduled_date,
      NEW.scheduled_start,
      60
    )
    LIMIT 1;
    
    -- If we found an available worker, assign them
    IF available_worker_id IS NOT NULL THEN
      NEW.worker_id := available_worker_id;
      NEW.status := 'confirmed';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists and create new one
DROP TRIGGER IF EXISTS auto_assign_worker_on_booking_trigger ON bookings;
CREATE TRIGGER auto_assign_worker_on_booking_trigger
  BEFORE INSERT OR UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION auto_assign_worker_on_booking();