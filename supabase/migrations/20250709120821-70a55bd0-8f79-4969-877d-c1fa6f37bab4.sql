-- Fix the ambiguous column reference in find_workers_for_coverage function
CREATE OR REPLACE FUNCTION public.find_workers_for_coverage(p_booking_id uuid, p_max_distance_priority integer DEFAULT 3)
 RETURNS TABLE(worker_id uuid, worker_name text, worker_email text, worker_phone text, distance_priority integer, customer_zipcode text)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  booking_record RECORD;
  target_day TEXT;
  service_end_time TIME;
BEGIN
  -- Get booking and customer details
  SELECT 
    b.*,
    u.zip_code as customer_zipcode,
    u.city as customer_city
  INTO booking_record
  FROM public.bookings b
  INNER JOIN public.users u ON b.customer_id = u.id
  WHERE b.id = p_booking_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found';
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
      WHEN u.zip_code = booking_record.customer_zipcode THEN 1
      WHEN LEFT(u.zip_code, 3) = LEFT(booking_record.customer_zipcode, 3) THEN 2
      ELSE 3
    END as distance_priority,
    booking_record.customer_zipcode
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
      WHEN u.zip_code = booking_record.customer_zipcode THEN 1
      WHEN LEFT(u.zip_code, 3) = LEFT(booking_record.customer_zipcode, 3) THEN 2
      ELSE 3
    END <= p_max_distance_priority
  ORDER BY 
    CASE 
      WHEN u.zip_code = booking_record.customer_zipcode THEN 1
      WHEN LEFT(u.zip_code, 3) = LEFT(booking_record.customer_zipcode, 3) THEN 2
      ELSE 3
    END,
    u.created_at;
END;
$function$;