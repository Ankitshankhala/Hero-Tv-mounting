-- Update find_workers_for_coverage to support guest bookings
CREATE OR REPLACE FUNCTION public.find_workers_for_coverage(p_booking_id uuid, p_max_distance_priority integer DEFAULT 3)
 RETURNS TABLE(worker_id uuid, worker_name text, worker_email text, worker_phone text, distance_priority integer, customer_zipcode text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  booking_record RECORD;
  target_day TEXT;
  service_end_time TIME;
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
  customer_zipcode := booking_record.customer_zipcode;
  IF customer_zipcode IS NULL OR LENGTH(customer_zipcode) < 5 THEN
    RAISE EXCEPTION 'Customer zipcode not found for booking. Cannot find workers for coverage.';
  END IF;
  
  -- Get day of week for the scheduled date
  target_day := TO_CHAR(booking_record.scheduled_date, 'Day');
  target_day := TRIM(target_day);
  
  -- Calculate end time
  service_end_time := booking_record.scheduled_start + INTERVAL '1 hour';
  
  RETURN QUERY
  SELECT 
    u.id as worker_id,
    u.name as worker_name,
    u.email as worker_email,
    u.phone as worker_phone,
    CASE 
      WHEN u.zip_code = customer_zipcode THEN 1
      WHEN LEFT(u.zip_code, 3) = LEFT(customer_zipcode, 3) THEN 2
      ELSE 3
    END as distance_priority,
    customer_zipcode
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
      AND wa.start_time <= booking_record.scheduled_start
      AND wa.end_time >= service_end_time
    )
    -- Exclude workers who already have conflicting bookings
    AND NOT EXISTS (
      SELECT 1 FROM public.bookings b2
      WHERE b2.worker_id = u.id
      AND b2.scheduled_date = booking_record.scheduled_date
      AND b2.status NOT IN ('cancelled', 'completed')
      AND (
        (b2.scheduled_start <= booking_record.scheduled_start AND 
         b2.scheduled_start + INTERVAL '1 hour' > booking_record.scheduled_start) OR
        (booking_record.scheduled_start <= b2.scheduled_start AND 
         booking_record.scheduled_start + INTERVAL '1 hour' > b2.scheduled_start)
      )
    )
    -- Exclude workers already assigned to this booking
    AND NOT EXISTS (
      SELECT 1 FROM public.worker_bookings wb
      WHERE wb.booking_id = p_booking_id AND wb.worker_id = u.id
    )
    -- Only include workers within the specified distance priority
    AND CASE 
      WHEN u.zip_code = customer_zipcode THEN 1
      WHEN LEFT(u.zip_code, 3) = LEFT(customer_zipcode, 3) THEN 2
      ELSE 3
    END <= p_max_distance_priority
  ORDER BY 
    CASE 
      WHEN u.zip_code = customer_zipcode THEN 1
      WHEN LEFT(u.zip_code, 3) = LEFT(customer_zipcode, 3) THEN 2
      ELSE 3
    END,
    u.created_at;
END;
$function$;