
-- Create a table to track notification attempts and responses
CREATE TABLE IF NOT EXISTS public.worker_coverage_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID NOT NULL REFERENCES public.bookings(id),
  worker_id UUID NOT NULL REFERENCES public.users(id),
  notification_type TEXT NOT NULL DEFAULT 'coverage_request', -- 'coverage_request', 'urgent_coverage'
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  response_at TIMESTAMP WITH TIME ZONE,
  response TEXT, -- 'accepted', 'declined', 'no_response'
  distance_priority INTEGER NOT NULL DEFAULT 1, -- 1=exact zip, 2=nearby, 3=regional
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.worker_coverage_notifications ENABLE ROW LEVEL SECURITY;

-- Create policies for worker coverage notifications
CREATE POLICY "Workers can view their own coverage notifications" 
  ON public.worker_coverage_notifications 
  FOR SELECT 
  USING (worker_id = auth.uid());

CREATE POLICY "Workers can update their own coverage notification responses" 
  ON public.worker_coverage_notifications 
  FOR UPDATE 
  USING (worker_id = auth.uid());

-- Function to find workers in expanding radius for coverage
CREATE OR REPLACE FUNCTION public.find_workers_for_coverage(
  p_booking_id UUID,
  p_max_distance_priority INTEGER DEFAULT 3
)
RETURNS TABLE(
  worker_id UUID, 
  worker_name TEXT, 
  worker_email TEXT, 
  worker_phone TEXT, 
  distance_priority INTEGER,
  customer_zipcode TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  booking_record RECORD;
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
$$;

-- Function to handle worker coverage response
CREATE OR REPLACE FUNCTION public.respond_to_coverage_request(
  p_notification_id UUID,
  p_response TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  notification_record RECORD;
  booking_record RECORD;
  worker_assigned BOOLEAN := false;
BEGIN
  -- Get notification details
  SELECT * INTO notification_record
  FROM public.worker_coverage_notifications
  WHERE id = p_notification_id AND worker_id = auth.uid();
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Notification not found or not authorized';
  END IF;
  
  -- Update notification response
  UPDATE public.worker_coverage_notifications
  SET response = p_response, response_at = now()
  WHERE id = p_notification_id;
  
  -- If worker accepted, try to assign them to the booking
  IF p_response = 'accepted' THEN
    -- Check if booking is still available
    SELECT * INTO booking_record
    FROM public.bookings
    WHERE id = notification_record.booking_id AND worker_id IS NULL;
    
    IF FOUND THEN
      -- Assign worker to booking
      UPDATE public.bookings
      SET worker_id = notification_record.worker_id, status = 'confirmed'
      WHERE id = notification_record.booking_id AND worker_id IS NULL;
      
      -- Create worker booking entry
      INSERT INTO public.worker_bookings (booking_id, worker_id, status)
      VALUES (notification_record.booking_id, notification_record.worker_id, 'assigned');
      
      -- Mark other notifications for this booking as declined
      UPDATE public.worker_coverage_notifications
      SET response = 'auto_declined', response_at = now()
      WHERE booking_id = notification_record.booking_id 
      AND id != p_notification_id 
      AND response IS NULL;
      
      worker_assigned := true;
    END IF;
  END IF;
  
  RETURN worker_assigned;
END;
$$;

-- Enhanced auto-assignment function that includes coverage notifications
CREATE OR REPLACE FUNCTION public.auto_assign_workers_with_coverage(
  p_booking_id UUID
)
RETURNS TABLE(assigned_worker_id UUID, assignment_status TEXT, notifications_sent INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  booking_record RECORD;
  worker_record RECORD;
  assignment_count INTEGER := 0;
  notification_count INTEGER := 0;
  max_distance INTEGER := 1;
BEGIN
  -- Get booking details
  SELECT b.*, u.zip_code as customer_zipcode
  INTO booking_record
  FROM public.bookings b
  INNER JOIN public.users u ON b.customer_id = u.id
  WHERE b.id = p_booking_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;
  
  -- Try to find workers in expanding radius
  WHILE assignment_count = 0 AND max_distance <= 3 LOOP
    -- Try direct assignment first
    FOR worker_record IN 
      SELECT * FROM public.find_workers_for_coverage(p_booking_id, max_distance)
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
  ELSE
    UPDATE public.bookings 
    SET status = 'pending'
    WHERE id = p_booking_id;
  END IF;
  
  -- Return results
  IF assignment_count = 0 THEN
    RETURN QUERY SELECT NULL::UUID, 'coverage_notifications_sent'::TEXT, notification_count;
  END IF;
  
  RETURN;
END;
$$;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_worker_coverage_notifications_booking_worker 
ON public.worker_coverage_notifications(booking_id, worker_id);

CREATE INDEX IF NOT EXISTS idx_worker_coverage_notifications_worker_sent 
ON public.worker_coverage_notifications(worker_id, sent_at);

CREATE INDEX IF NOT EXISTS idx_worker_coverage_notifications_response 
ON public.worker_coverage_notifications(response, response_at);
