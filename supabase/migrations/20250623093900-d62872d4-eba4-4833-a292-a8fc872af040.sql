
-- Add payment method storage to bookings table
ALTER TABLE public.bookings 
ADD COLUMN stripe_customer_id TEXT,
ADD COLUMN stripe_payment_method_id TEXT,
ADD COLUMN requires_manual_payment BOOLEAN DEFAULT true,
ADD COLUMN cancellation_deadline TIMESTAMP WITH TIME ZONE,
ADD COLUMN late_fee_amount NUMERIC DEFAULT 0,
ADD COLUMN late_fee_charged BOOLEAN DEFAULT false;

-- Create table for service modifications during job
CREATE TABLE public.booking_service_modifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  worker_id UUID NOT NULL,
  modification_type TEXT NOT NULL CHECK (modification_type IN ('addition', 'removal')),
  service_name TEXT NOT NULL,
  price_change NUMERIC NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create table for manual charges
CREATE TABLE public.manual_charges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  charged_by UUID NOT NULL,
  charge_type TEXT NOT NULL CHECK (charge_type IN ('service_modification', 'late_fee', 'additional_service')),
  amount NUMERIC NOT NULL,
  stripe_payment_intent_id TEXT,
  description TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  processed_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS on new tables
ALTER TABLE public.booking_service_modifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manual_charges ENABLE ROW LEVEL SECURITY;

-- RLS policies for booking_service_modifications
CREATE POLICY "Workers can view their booking modifications" 
ON public.booking_service_modifications FOR SELECT 
USING (
  worker_id = auth.uid() OR 
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Workers can add service modifications" 
ON public.booking_service_modifications FOR INSERT 
WITH CHECK (worker_id = auth.uid());

-- RLS policies for manual_charges
CREATE POLICY "Users can view relevant charges" 
ON public.manual_charges FOR SELECT 
USING (
  charged_by = auth.uid() OR 
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin') OR
  EXISTS (SELECT 1 FROM public.bookings WHERE id = booking_id AND (worker_id = auth.uid() OR customer_id = auth.uid()))
);

CREATE POLICY "Workers and admins can create charges" 
ON public.manual_charges FOR INSERT 
WITH CHECK (
  charged_by = auth.uid() AND 
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('worker', 'admin'))
);

-- Function to calculate cancellation deadline (24 hours before scheduled time)
CREATE OR REPLACE FUNCTION calculate_cancellation_deadline(scheduled_date DATE, scheduled_start TIME)
RETURNS TIMESTAMP WITH TIME ZONE
LANGUAGE SQL
AS $$
  SELECT (scheduled_date + scheduled_start - INTERVAL '24 hours') AT TIME ZONE 'UTC';
$$;

-- Trigger to automatically set cancellation deadline
CREATE OR REPLACE FUNCTION set_cancellation_deadline()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.cancellation_deadline = calculate_cancellation_deadline(NEW.scheduled_date, NEW.scheduled_start);
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_booking_cancellation_deadline
  BEFORE INSERT OR UPDATE OF scheduled_date, scheduled_start
  ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION set_cancellation_deadline();
