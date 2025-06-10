
-- Create worker_schedules table for workers to set their availability
CREATE TABLE public.worker_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_available BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(worker_id, date, start_time)
);

-- Create on_site_charges table for tracking additional services/charges
CREATE TABLE public.on_site_charges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE,
  worker_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  service_name TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  description TEXT,
  stripe_payment_id TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed')),
  charged_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Add late_fee_applied column to bookings table
ALTER TABLE public.bookings 
ADD COLUMN late_fee_applied BOOLEAN DEFAULT false,
ADD COLUMN late_fee_amount NUMERIC DEFAULT 0,
ADD COLUMN late_fee_applied_at TIMESTAMPTZ;

-- Enable RLS on new tables
ALTER TABLE public.worker_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.on_site_charges ENABLE ROW LEVEL SECURITY;

-- RLS policies for worker_schedules
CREATE POLICY "Workers can manage their own schedules" ON public.worker_schedules
  FOR ALL USING (
    worker_id = auth.uid() OR 
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- RLS policies for on_site_charges
CREATE POLICY "Workers can create charges for their bookings" ON public.on_site_charges
  FOR INSERT WITH CHECK (
    worker_id = auth.uid() AND
    EXISTS (SELECT 1 FROM public.bookings WHERE id = booking_id AND worker_id = auth.uid())
  );

CREATE POLICY "Workers and customers can view relevant charges" ON public.on_site_charges
  FOR SELECT USING (
    worker_id = auth.uid() OR
    EXISTS (SELECT 1 FROM public.bookings WHERE id = booking_id AND customer_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- Function to apply late cancellation fees automatically
CREATE OR REPLACE FUNCTION apply_late_cancellation_fee()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Apply $90 late fee to bookings cancelled within 24 hours
  UPDATE public.bookings 
  SET 
    late_fee_applied = true,
    late_fee_amount = 90,
    late_fee_applied_at = now(),
    pending_payment_amount = COALESCE(pending_payment_amount, 0) + 90
  WHERE 
    status = 'cancelled' 
    AND late_fee_applied = false
    AND scheduled_at - INTERVAL '24 hours' <= now()
    AND updated_at >= now() - INTERVAL '1 hour'; -- Only recently cancelled bookings
END;
$$;

-- Create a function to handle worker schedule management
CREATE OR REPLACE FUNCTION upsert_worker_schedule(
  p_worker_id UUID,
  p_date DATE,
  p_start_time TIME,
  p_end_time TIME,
  p_is_available BOOLEAN DEFAULT true,
  p_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  schedule_id UUID;
BEGIN
  INSERT INTO public.worker_schedules (
    worker_id, date, start_time, end_time, is_available, notes, updated_at
  ) VALUES (
    p_worker_id, p_date, p_start_time, p_end_time, p_is_available, p_notes, now()
  )
  ON CONFLICT (worker_id, date, start_time)
  DO UPDATE SET
    end_time = EXCLUDED.end_time,
    is_available = EXCLUDED.is_available,
    notes = EXCLUDED.notes,
    updated_at = now()
  RETURNING id INTO schedule_id;
  
  RETURN schedule_id;
END;
$$;
