-- Update auto-assignment function to handle guest bookings
-- The function needs to extract customer zipcode from guest_customer_info when customer_id is null

CREATE OR REPLACE FUNCTION public.auto_assign_workers_with_coverage(p_booking_id uuid)
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
  
  -- Validate that we have zipcode information
  IF booking_record.customer_zipcode IS NULL OR LENGTH(booking_record.customer_zipcode) < 5 THEN
    RAISE EXCEPTION 'Customer zipcode not found for booking. Cannot assign workers.';
  END IF;
  
  customer_zipcode := booking_record.customer_zipcode;
  
  -- Try to find workers in expanding radius
  WHILE assignment_count = 0 AND max_distance <= 3 LOOP
    -- Try direct assignment first using the existing find_available_workers function
    FOR worker_record IN 
      SELECT * FROM public.find_available_workers(
        customer_zipcode,
        booking_record.scheduled_date,
        booking_record.scheduled_start,
        60 -- 1 hour duration
      )
      LIMIT 1
    LOOP
      -- Assign worker directly if found
      UPDATE public.bookings 
      SET worker_id = worker_record.worker_id, status = 'confirmed'
      WHERE id = p_booking_id;
      
      INSERT INTO public.worker_bookings (booking_id, worker_id, status)
      VALUES (p_booking_id, worker_record.worker_id, 'assigned');
      
      assignment_count := assignment_count + 1;
      
      RETURN QUERY SELECT worker_record.worker_id, 'direct_assigned'::TEXT, 0;
    END LOOP;
    
    -- If no direct assignment, send coverage notifications
    IF assignment_count = 0 THEN
      FOR worker_record IN 
        SELECT * FROM public.find_workers_for_coverage(p_booking_id, max_distance)
        LIMIT 5 -- Notify up to 5 workers at each distance level
      LOOP
        -- Create coverage notification
        INSERT INTO public.worker_coverage_notifications 
        (booking_id, worker_id, distance_priority, notification_type)
        VALUES (p_booking_id, worker_record.worker_id, worker_record.distance_priority, 'coverage_request');
        
        notification_count := notification_count + 1;
      END LOOP;
      
      -- If notifications were sent, exit loop
      IF notification_count > 0 THEN
        EXIT;
      END IF;
    END IF;
    
    max_distance := max_distance + 1;
  END LOOP;
  
  -- Update booking status based on results
  IF assignment_count > 0 THEN
    UPDATE public.bookings 
    SET status = 'confirmed'
    WHERE id = p_booking_id;
  ELSIF notification_count > 0 THEN
    UPDATE public.bookings 
    SET status = 'pending'
    WHERE id = p_booking_id;
    
    -- Log coverage notification for admin tracking
    INSERT INTO public.sms_logs (booking_id, recipient_number, message, status, error_message)
    VALUES (p_booking_id, 'system', 'Coverage notifications sent to ' || notification_count || ' workers', 'sent', NULL);
  ELSE
    UPDATE public.bookings 
    SET status = 'pending'
    WHERE id = p_booking_id;
    
    -- Log that no workers were available for admin attention
    INSERT INTO public.sms_logs (booking_id, recipient_number, message, status, error_message)
    VALUES (p_booking_id, 'system', 'No workers available in service area - requires manual assignment', 'failed', 'No coverage available');
  END IF;
  
  -- Return results
  IF assignment_count = 0 THEN
    RETURN QUERY SELECT NULL::UUID, 'coverage_notifications_sent'::TEXT, notification_count;
  END IF;
  
  RETURN;
END;
$function$;