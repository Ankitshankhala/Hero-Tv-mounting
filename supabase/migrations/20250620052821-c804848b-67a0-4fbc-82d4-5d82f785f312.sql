
-- Create WorkerBookings table for tracking worker assignments
CREATE TABLE IF NOT EXISTS public.worker_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  worker_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'assigned' CHECK (status IN ('assigned', 'accepted', 'declined', 'completed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(booking_id, worker_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_worker_bookings_booking_id ON public.worker_bookings(booking_id);
CREATE INDEX IF NOT EXISTS idx_worker_bookings_worker_id ON public.worker_bookings(worker_id);
CREATE INDEX IF NOT EXISTS idx_worker_bookings_status ON public.worker_bookings(status);

-- Enable RLS on worker_bookings
ALTER TABLE public.worker_bookings ENABLE ROW LEVEL SECURITY;

-- RLS policies for worker_bookings
CREATE POLICY "Workers can view their own assignments" ON public.worker_bookings 
FOR SELECT USING (
  worker_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE users.id = auth.uid() 
    AND users.role = 'admin'
  )
);

CREATE POLICY "Admins can manage all worker assignments" ON public.worker_bookings 
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE users.id = auth.uid() 
    AND users.role = 'admin'
  )
);

-- Create function to find available workers by zipcode and datetime
CREATE OR REPLACE FUNCTION public.find_available_workers(
  p_zipcode TEXT,
  p_scheduled_date DATE,
  p_scheduled_start TIME,
  p_duration_minutes INTEGER DEFAULT 60
)
RETURNS TABLE (
  worker_id UUID,
  worker_name TEXT,
  worker_email TEXT,
  worker_phone TEXT,
  distance_priority INTEGER
) AS $$
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
  INNER JOIN public.worker_availability wa ON u.id = wa.worker_id
  WHERE 
    u.role = 'worker'
    AND u.is_active = true
    AND u.zip_code IS NOT NULL
    -- Check if worker is available on the requested day and time
    AND wa.day_of_week::TEXT = target_day
    AND wa.start_time <= p_scheduled_start
    AND wa.end_time >= end_time
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
  ORDER BY distance_priority, u.created_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to auto-assign workers to bookings
CREATE OR REPLACE FUNCTION public.auto_assign_workers_to_booking(
  p_booking_id UUID
)
RETURNS TABLE (
  assigned_worker_id UUID,
  assignment_status TEXT
) AS $$
DECLARE
  booking_record RECORD;
  worker_record RECORD;
  assignment_count INTEGER := 0;
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
  
  -- Find available workers
  FOR worker_record IN 
    SELECT * FROM public.find_available_workers(
      booking_record.customer_zipcode,
      booking_record.scheduled_date,
      booking_record.scheduled_start,
      60 -- Default 1 hour duration
    )
    LIMIT 3 -- Assign to max 3 workers
  LOOP
    -- Create worker assignment
    INSERT INTO public.worker_bookings (booking_id, worker_id, status)
    VALUES (p_booking_id, worker_record.worker_id, 'assigned');
    
    assignment_count := assignment_count + 1;
    
    RETURN QUERY SELECT worker_record.worker_id, 'assigned'::TEXT;
  END LOOP;
  
  -- Update booking status based on assignments
  IF assignment_count > 0 THEN
    UPDATE public.bookings 
    SET status = 'confirmed'
    WHERE id = p_booking_id;
  ELSE
    UPDATE public.bookings 
    SET status = 'pending'
    WHERE id = p_booking_id;
  END IF;
  
  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
