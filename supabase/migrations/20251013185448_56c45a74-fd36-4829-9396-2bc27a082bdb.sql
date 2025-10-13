-- Create smart worker selection function that balances workload and availability
CREATE OR REPLACE FUNCTION public.select_best_available_worker(
  p_zipcode TEXT,
  p_date DATE,
  p_time TIME,
  p_duration_minutes INTEGER DEFAULT 60,
  p_preferred_worker_id UUID DEFAULT NULL
)
RETURNS TABLE(
  worker_id UUID,
  worker_name TEXT,
  worker_email TEXT,
  worker_phone TEXT,
  selection_reason TEXT,
  workload_count INTEGER,
  availability_score INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_worker RECORD;
BEGIN
  -- Priority 1: Use preferred worker if specified and available
  IF p_preferred_worker_id IS NOT NULL THEN
    SELECT w.* INTO v_worker
    FROM public.find_available_workers_by_zip(p_zipcode, p_date, p_time, p_duration_minutes) w
    WHERE w.worker_id = p_preferred_worker_id
    LIMIT 1;
    
    IF FOUND THEN
      RETURN QUERY SELECT 
        v_worker.worker_id,
        v_worker.worker_name,
        v_worker.worker_email,
        v_worker.worker_phone,
        'customer_preference'::TEXT as selection_reason,
        0 as workload_count,
        0 as availability_score;
      RETURN;
    END IF;
  END IF;
  
  -- Priority 2: Select worker with lowest workload for the week
  FOR v_worker IN 
    SELECT 
      w.*,
      -- Count bookings for this week
      COALESCE((SELECT COUNT(*) 
       FROM public.bookings b 
       WHERE b.worker_id = w.worker_id 
       AND b.scheduled_date BETWEEN 
         (p_date - EXTRACT(DOW FROM p_date)::INTEGER) AND 
         (p_date + (6 - EXTRACT(DOW FROM p_date)::INTEGER))
       AND b.status NOT IN ('cancelled', 'pending')
      ), 0) as workload,
      -- Availability score (higher is better)
      w.distance_miles::INTEGER as availability
    FROM public.find_available_workers_by_zip(p_zipcode, p_date, p_time, p_duration_minutes) w
    ORDER BY workload ASC, availability ASC, random()  -- Random for fairness when tied
    LIMIT 1
  LOOP
    RETURN QUERY SELECT
      v_worker.worker_id,
      v_worker.worker_name,
      v_worker.worker_email,
      v_worker.worker_phone,
      CASE 
        WHEN v_worker.workload < 3 THEN 'balanced_workload'
        WHEN v_worker.workload >= 3 AND v_worker.workload < 6 THEN 'fair_distribution'
        ELSE 'assigned_available'
      END::TEXT as selection_reason,
      v_worker.workload::INTEGER,
      COALESCE(v_worker.availability::INTEGER, 0);
    RETURN;
  END LOOP;
  
  -- No workers available
  RETURN;
END;
$$;

-- Update auto-assignment function to use smart worker selection
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
  
  -- Use smart worker selection instead of arbitrary LIMIT 1
  FOR worker_record IN 
    SELECT * FROM public.select_best_available_worker(
      customer_zipcode,
      booking_record.scheduled_date,
      booking_record.scheduled_start,
      60,
      booking_record.preferred_worker_id  -- Respect customer preference
    )
    LIMIT 1
  LOOP
    -- Assign worker directly
    UPDATE public.bookings 
    SET worker_id = worker_record.worker_id, status = 'confirmed'
    WHERE id = p_booking_id;
    
    INSERT INTO public.worker_bookings (booking_id, worker_id, status)
    VALUES (p_booking_id, worker_record.worker_id, 'assigned');
    
    -- Log the smart assignment reason
    INSERT INTO public.sms_logs (booking_id, recipient_number, message, status, error_message)
    VALUES (
      p_booking_id, 
      'system', 
      'Smart assignment: ' || worker_record.worker_name || ' (' || worker_record.selection_reason || ', workload: ' || worker_record.workload_count || ')',
      'sent', 
      NULL
    );
    
    assignment_count := assignment_count + 1;
    
    RETURN QUERY SELECT worker_record.worker_id, 'smart_assigned'::TEXT, 0;
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