
-- Create a table to track payment sessions and booking payments
CREATE TABLE public.payment_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE,
  stripe_session_id TEXT UNIQUE,
  amount INTEGER NOT NULL, -- Amount in cents
  currency TEXT DEFAULT 'usd',
  status TEXT DEFAULT 'pending', -- 'pending', 'paid', 'failed', 'expired'
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add geolocation fields to bookings table for worker assignment
ALTER TABLE public.bookings 
ADD COLUMN IF NOT EXISTS customer_latitude DECIMAL(10, 8),
ADD COLUMN IF NOT EXISTS customer_longitude DECIMAL(11, 8),
ADD COLUMN IF NOT EXISTS customer_zipcode TEXT;

-- Add geolocation fields to users table for worker locations
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8),
ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8);

-- Enable RLS on payment_sessions
ALTER TABLE public.payment_sessions ENABLE ROW LEVEL SECURITY;

-- Create policies for payment_sessions
CREATE POLICY "Users can view their own payment sessions" 
  ON public.payment_sessions 
  FOR SELECT 
  USING (
    booking_id IN (
      SELECT id FROM public.bookings WHERE customer_id = auth.uid()
    )
  );

CREATE POLICY "Service can insert payment sessions" 
  ON public.payment_sessions 
  FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "Service can update payment sessions" 
  ON public.payment_sessions 
  FOR UPDATE 
  USING (true);
