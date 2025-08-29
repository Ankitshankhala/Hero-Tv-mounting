-- Fix booking creation issues by adding RLS policies for authenticated users

-- Add policy to allow authenticated users to create bookings
CREATE POLICY "Authenticated users can create bookings" 
ON public.bookings 
FOR INSERT 
WITH CHECK (
  auth.uid() IS NOT NULL AND 
  customer_id = auth.uid()
);

-- Add policy to allow authenticated users to create booking services
CREATE POLICY "Authenticated users can create booking services" 
ON public.booking_services 
FOR INSERT 
WITH CHECK (
  auth.uid() IS NOT NULL AND 
  EXISTS (
    SELECT 1 FROM bookings b 
    WHERE b.id = booking_services.booking_id 
    AND b.customer_id = auth.uid()
  )
);