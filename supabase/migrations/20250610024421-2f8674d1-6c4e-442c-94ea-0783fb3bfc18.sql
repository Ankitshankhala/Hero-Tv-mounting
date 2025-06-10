
-- From 003_create_functions.sql
-- Function to calculate booking total
CREATE OR REPLACE FUNCTION calculate_booking_total(service_ids UUID[], quantities INTEGER[])
RETURNS TABLE(total_price DECIMAL, total_duration INTEGER) AS $$
DECLARE
  service_record RECORD;
  i INTEGER;
  price_sum DECIMAL := 0;
  duration_sum INTEGER := 0;
BEGIN
  FOR i IN 1..array_length(service_ids, 1) LOOP
    SELECT base_price, duration_minutes INTO service_record
    FROM services 
    WHERE id = service_ids[i] AND is_active = true;
    
    IF FOUND THEN
      price_sum := price_sum + (service_record.base_price * quantities[i]);
      duration_sum := duration_sum + (service_record.duration_minutes * quantities[i]);
    END IF;
  END LOOP;
  
  -- Add 15 minute buffer for multi-service bookings
  IF array_length(service_ids, 1) > 1 THEN
    duration_sum := duration_sum + 15;
  END IF;
  
  RETURN QUERY SELECT price_sum, duration_sum;
END;
$$ LANGUAGE plpgsql;

-- Function to check cancellation fee
CREATE OR REPLACE FUNCTION calculate_cancellation_fee(booking_id UUID)
RETURNS DECIMAL AS $$
DECLARE
  booking_record RECORD;
  hours_until_job INTEGER;
BEGIN
  SELECT scheduled_at, total_price INTO booking_record
  FROM bookings 
  WHERE id = booking_id;
  
  IF NOT FOUND THEN
    RETURN 0;
  END IF;
  
  hours_until_job := EXTRACT(EPOCH FROM (booking_record.scheduled_at - NOW())) / 3600;
  
  -- Apply $90 fee if cancelled within 24-26 hours
  IF hours_until_job >= 24 AND hours_until_job <= 26 THEN
    RETURN 90.00;
  END IF;
  
  RETURN 0;
END;
$$ LANGUAGE plpgsql;

-- Function to find available workers
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
    u.region = job_region AND
    wa.day_of_week = job_day_of_week AND
    wa.start_time <= job_time AND
    wa.end_time >= job_end_time AND
    NOT EXISTS (
      SELECT 1
      FROM bookings b
      WHERE 
        b.worker_id = wa.worker_id AND
        b.status IN ('confirmed', 'in_progress') AND
        DATE(b.scheduled_at) = job_date AND
        (
          (TIME(b.scheduled_at) <= job_time AND 
           TIME(b.scheduled_at) + (b.total_duration_minutes * INTERVAL '1 minute') >= job_time)
          OR
          (TIME(b.scheduled_at) >= job_time AND 
           TIME(b.scheduled_at) <= job_end_time)
        )
    );
END;
$$ LANGUAGE plpgsql;

-- Function to auto-assign worker trigger
CREATE OR REPLACE FUNCTION auto_assign_worker()
RETURNS TRIGGER AS $$
DECLARE
  available_worker UUID;
BEGIN
  -- Only try to assign if no worker is already assigned
  IF NEW.worker_id IS NULL AND NEW.status = 'pending' THEN
    SELECT worker_id INTO available_worker
    FROM find_available_workers(
      DATE(NEW.scheduled_at),
      TIME(NEW.scheduled_at),
      NEW.total_duration_minutes,
      (SELECT region FROM users WHERE id = NEW.customer_id)
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

-- Create trigger for auto-assignment
DROP TRIGGER IF EXISTS assign_worker_trigger ON bookings;
CREATE TRIGGER assign_worker_trigger
  BEFORE INSERT OR UPDATE 
  ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION auto_assign_worker();

-- Function to track cancellation fees
CREATE OR REPLACE FUNCTION track_cancellation_fee()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status != 'cancelled' AND NEW.status = 'cancelled' THEN
    NEW.cancellation_fee := calculate_cancellation_fee(NEW.id);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for cancellation fee
DROP TRIGGER IF EXISTS cancellation_trigger ON bookings;
CREATE TRIGGER cancellation_trigger
  BEFORE UPDATE 
  ON bookings
  FOR EACH ROW
  WHEN (OLD.status != 'cancelled' AND NEW.status = 'cancelled')
  EXECUTE FUNCTION track_cancellation_fee();
