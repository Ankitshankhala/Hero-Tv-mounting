-- Fix legacy database functions to work with current table structure

-- Update the find_available_workers function in 003_create_functions.sql
CREATE OR REPLACE FUNCTION find_available_workers(
  job_date DATE,
  job_time TIME,
  job_duration INTEGER,
  job_region TEXT
)
RETURNS TABLE(worker_id UUID) AS $$
DECLARE
  job_day_of_week INTEGER;
  job_end_time TIME;
BEGIN
  job_day_of_week := EXTRACT(DOW FROM job_date);
  job_end_time := job_time + (job_duration * INTERVAL '1 minute');
  
  RETURN QUERY
  SELECT DISTINCT wa.worker_id
  FROM worker_availability wa
  JOIN users u ON u.id = wa.worker_id
  WHERE 
    u.role = 'worker' AND
    u.is_active = true AND
    u.zip_code IS NOT NULL AND
    wa.day_of_week = job_day_of_week AND
    wa.start_time <= job_time AND
    wa.end_time >= job_end_time AND
    NOT EXISTS (
      -- Check if worker already has a booking during this time
      SELECT 1
      FROM bookings b
      WHERE 
        b.worker_id = wa.worker_id AND
        b.status IN ('confirmed', 'in_progress') AND
        b.scheduled_date = job_date AND
        (
          (b.scheduled_start <= job_time AND 
           b.scheduled_start + (job_duration * INTERVAL '1 minute') > job_time)
          OR
          (b.scheduled_start >= job_time AND 
           b.scheduled_start < job_end_time)
        )
    );
END;
$$ LANGUAGE plpgsql;

-- Update the auto_assign_worker function to work with current table structure
CREATE OR REPLACE FUNCTION auto_assign_worker()
RETURNS TRIGGER AS $$
DECLARE
  available_worker UUID;
  service_duration INTEGER := 60; -- Default 1 hour duration
BEGIN
  -- Only try to assign if no worker is already assigned
  IF NEW.worker_id IS NULL AND NEW.status = 'pending' THEN
    -- Get customer zipcode
    SELECT worker_id INTO available_worker
    FROM find_available_workers(
      NEW.scheduled_date,
      NEW.scheduled_start,
      service_duration,
      (SELECT zip_code FROM users WHERE id = NEW.customer_id)
    )
    LIMIT 1;
    
    IF available_worker IS NOT NULL THEN
      NEW.worker_id := available_worker;
      NEW.status := 'confirmed';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;