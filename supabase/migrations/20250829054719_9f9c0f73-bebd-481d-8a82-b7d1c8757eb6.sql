-- Implement TaskRabbit-like area selection with multiple active areas and strict ZIP assignment

-- 1. Add indexes for better performance on ZIP lookups
CREATE INDEX IF NOT EXISTS idx_worker_service_zipcodes_zipcode 
ON worker_service_zipcodes(zipcode);

CREATE INDEX IF NOT EXISTS idx_worker_service_zipcodes_worker_id 
ON worker_service_zipcodes(worker_id);

CREATE INDEX IF NOT EXISTS idx_worker_service_areas_worker_active 
ON worker_service_areas(worker_id, is_active);

-- 2. Create strict ZIP-based worker finder function
CREATE OR REPLACE FUNCTION public.find_available_workers_by_zip(
  p_customer_zipcode TEXT,
  p_date DATE,
  p_time TIME,
  p_duration_minutes INTEGER DEFAULT 60
)
RETURNS TABLE(
  worker_id UUID,
  distance_priority INTEGER,
  available_slots INTEGER
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT
    u.id as worker_id,
    1 as distance_priority, -- All ZIP matches have same priority
    5 as available_slots   -- Simplified for now
  FROM users u
  INNER JOIN worker_service_zipcodes wsz ON u.id = wsz.worker_id
  INNER JOIN worker_service_areas wsa ON wsz.service_area_id = wsa.id
  WHERE u.role = 'worker'
    AND u.is_active = true
    AND wsa.is_active = true
    AND wsz.zipcode = p_customer_zipcode
    -- Check worker availability for the requested time
    AND EXISTS (
      SELECT 1 FROM worker_availability wa
      WHERE wa.worker_id = u.id
        AND wa.day_of_week = EXTRACT(DOW FROM p_date)::day_of_week
        AND wa.start_time <= p_time
        AND wa.end_time >= (p_time + (p_duration_minutes || ' minutes')::INTERVAL)::TIME
    )
    -- Ensure worker is not already booked at this time
    AND NOT EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.worker_id = u.id
        AND b.scheduled_date = p_date
        AND b.scheduled_start < (p_time + (p_duration_minutes || ' minutes')::INTERVAL)::TIME
        AND (b.scheduled_start + INTERVAL '1 hour') > p_time -- Assuming 1hr default duration for existing bookings
        AND b.status NOT IN ('cancelled', 'failed')
    )
  ORDER BY u.created_at; -- FIFO for fairness
END;
$$;

-- 3. Update auto-assignment function to use strict ZIP coverage
CREATE OR REPLACE FUNCTION public.auto_assign_workers_with_strict_zip_coverage(p_booking_id uuid)
RETURNS TABLE(assigned_worker_id uuid, assignment_status text, notifications_sent integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  booking_record RECORD;
  worker_record RECORD;
  assignment_count INTEGER := 0;
  customer_zipcode TEXT;
BEGIN
  -- Get booking and customer details (handle both authenticated users and guests)
  SELECT 
    b.*,
    CASE 
      WHEN b.customer_id IS NOT NULL THEN u.zip_code
      ELSE b.guest_customer_info->>'zipcode'
    END as customer_zipcode,
    CASE 
      WHEN b.customer_id IS NOT NULL THEN u.city
      ELSE b.guest_customer_info->>'city'
    END as customer_city
  INTO booking_record
  FROM public.bookings b
  LEFT JOIN public.users u ON b.customer_id = u.id
  WHERE b.id = p_booking_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;
  
  -- Validate that we have zipcode information
  IF booking_record.customer_zipcode IS NULL OR LENGTH(booking_record.customer_zipcode) < 5 THEN
    RAISE EXCEPTION 'Customer zipcode not found for booking. Cannot assign workers.';
  END IF;
  
  customer_zipcode := booking_record.customer_zipcode;
  
  -- Use strict ZIP-based assignment only
  FOR worker_record IN 
    SELECT * FROM public.find_available_workers_by_zip(
      customer_zipcode,
      booking_record.scheduled_date,
      booking_record.scheduled_start,
      60 -- 1 hour duration
    )
    LIMIT 1
  LOOP
    -- Assign worker directly
    UPDATE public.bookings 
    SET worker_id = worker_record.worker_id, status = 'confirmed'
    WHERE id = p_booking_id;
    
    INSERT INTO public.worker_bookings (booking_id, worker_id, status)
    VALUES (p_booking_id, worker_record.worker_id, 'assigned');
    
    assignment_count := assignment_count + 1;
    
    RETURN QUERY SELECT worker_record.worker_id, 'zip_assigned'::TEXT, 0;
  END LOOP;
  
  -- If no ZIP coverage, leave booking as pending (no fallback assignment)
  IF assignment_count = 0 THEN
    UPDATE public.bookings 
    SET status = 'pending'
    WHERE id = p_booking_id;
    
    -- Log that no workers available in ZIP for admin attention
    INSERT INTO public.sms_logs (booking_id, recipient_number, message, status, error_message)
    VALUES (p_booking_id, 'system', 'No workers available in ZIP code ' || customer_zipcode || ' - requires manual assignment', 'failed', 'No ZIP coverage available');
    
    RETURN QUERY SELECT NULL::UUID, 'no_zip_coverage'::TEXT, 0;
  END IF;
  
  RETURN;
END;
$$;

-- 4. Create helper function to get all active ZIP codes for a worker
CREATE OR REPLACE FUNCTION public.get_worker_active_zipcodes(p_worker_id uuid)
RETURNS TEXT[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  zipcodes TEXT[];
BEGIN
  SELECT ARRAY_AGG(DISTINCT wsz.zipcode ORDER BY wsz.zipcode)
  INTO zipcodes
  FROM worker_service_zipcodes wsz
  INNER JOIN worker_service_areas wsa ON wsz.service_area_id = wsa.id
  WHERE wsz.worker_id = p_worker_id
    AND wsa.is_active = true;
    
  RETURN COALESCE(zipcodes, ARRAY[]::TEXT[]);
END;
$$;

-- 5. Create function to toggle service area active status
CREATE OR REPLACE FUNCTION public.toggle_service_area_status(p_area_id uuid, p_is_active boolean)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Verify the area belongs to the current user
  IF NOT EXISTS (
    SELECT 1 FROM worker_service_areas 
    WHERE id = p_area_id AND worker_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Service area not found or access denied';
  END IF;
  
  UPDATE worker_service_areas 
  SET is_active = p_is_active, updated_at = now()
  WHERE id = p_area_id;
  
  RETURN true;
END;
$$;