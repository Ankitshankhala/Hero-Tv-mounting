-- Step 1: Drop conflicting auto-assignment triggers to prevent duplicate calls
DROP TRIGGER IF EXISTS trigger_auto_assign_on_payment_auth ON bookings;
DROP TRIGGER IF EXISTS trigger_auto_assign_on_confirmation ON bookings;

-- Step 2: Create idempotent worker assignment function
CREATE OR REPLACE FUNCTION public.assign_worker_idempotent(p_booking_id uuid, p_worker_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Insert worker booking assignment with ON CONFLICT DO NOTHING for idempotency
  INSERT INTO public.worker_bookings (booking_id, worker_id, status, ack_status, ack_deadline)
  VALUES (p_booking_id, p_worker_id, 'assigned', 'pending', now() + interval '10 minutes')
  ON CONFLICT (booking_id, worker_id) DO NOTHING;
  
  -- Update booking with worker assignment (only if not already assigned)
  UPDATE public.bookings 
  SET worker_id = p_worker_id
  WHERE id = p_booking_id AND worker_id IS NULL;
  
  RETURN TRUE;
END;
$function$;

-- Step 3: Update the existing auto-assignment function to use idempotent assignment
CREATE OR REPLACE FUNCTION public.auto_assign_workers_with_polygon_coverage(p_booking_id uuid)
RETURNS TABLE(assigned_worker_id uuid, assignment_status text, notifications_sent integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  booking_record RECORD;
  worker_record RECORD;
  assignment_count INTEGER := 0;
  notification_count INTEGER := 0;
  max_distance INTEGER := 1;
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
  
  -- Skip if worker already assigned
  IF booking_record.worker_id IS NOT NULL THEN
    RETURN QUERY SELECT booking_record.worker_id, 'already_assigned'::TEXT, 0;
    RETURN;
  END IF;
  
  -- Validate that we have zipcode information
  IF booking_record.customer_zipcode IS NULL OR LENGTH(booking_record.customer_zipcode) < 5 THEN
    RAISE EXCEPTION 'Customer zipcode not found for booking. Cannot assign workers.';
  END IF;
  
  customer_zipcode := booking_record.customer_zipcode;
  
  -- Try polygon-based assignment first
  FOR worker_record IN 
    SELECT * FROM public.find_available_workers_polygon(
      customer_zipcode,
      booking_record.scheduled_date,
      booking_record.scheduled_start,
      60 -- 1 hour duration
    )
    LIMIT 1
  LOOP
    -- Use idempotent assignment
    PERFORM public.assign_worker_idempotent(p_booking_id, worker_record.worker_id);
    
    UPDATE public.bookings 
    SET status = 'confirmed'
    WHERE id = p_booking_id;
    
    assignment_count := assignment_count + 1;
    
    RETURN QUERY SELECT worker_record.worker_id, 'polygon_assigned'::TEXT, 0;
  END LOOP;
  
  -- Fallback to original assignment if no polygon match
  IF assignment_count = 0 THEN
    FOR worker_record IN 
      SELECT * FROM public.find_available_workers(
        customer_zipcode,
        booking_record.scheduled_date,
        booking_record.scheduled_start,
        60 -- 1 hour duration
      )
      LIMIT 1
    LOOP
      -- Use idempotent assignment
      PERFORM public.assign_worker_idempotent(p_booking_id, worker_record.worker_id);
      
      UPDATE public.bookings 
      SET status = 'confirmed'
      WHERE id = p_booking_id;
      
      assignment_count := assignment_count + 1;
      
      RETURN QUERY SELECT worker_record.worker_id, 'fallback_assigned'::TEXT, 0;
    END LOOP;
  END IF;
  
  -- If no assignment possible, just update status
  IF assignment_count = 0 THEN
    UPDATE public.bookings 
    SET status = 'pending'
    WHERE id = p_booking_id;
    
    RETURN QUERY SELECT NULL::UUID, 'no_assignment_possible'::TEXT, 0;
  END IF;
  
  RETURN;
END;
$function$;