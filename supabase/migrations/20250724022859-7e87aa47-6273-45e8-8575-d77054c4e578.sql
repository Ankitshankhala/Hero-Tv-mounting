-- Add support for guest bookings
ALTER TABLE public.bookings 
ADD COLUMN IF NOT EXISTS guest_customer_info JSONB,
ALTER COLUMN customer_id DROP NOT NULL;

-- Update RLS policies to allow guest bookings
DROP POLICY IF EXISTS "Anyone can create bookings" ON public.bookings;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.bookings;

CREATE POLICY "Anyone can create bookings including guests" 
ON public.bookings 
FOR INSERT 
WITH CHECK (true);

-- Allow viewing bookings for guests using payment_intent_id
CREATE POLICY "Guests can view bookings via payment intent" 
ON public.bookings 
FOR SELECT 
USING (
  customer_id = auth.uid() OR 
  worker_id = auth.uid() OR 
  (customer_id IS NULL AND payment_intent_id IS NOT NULL) OR
  (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'::user_role))
);

-- Update transactions table to support guest bookings
ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS guest_customer_email TEXT;