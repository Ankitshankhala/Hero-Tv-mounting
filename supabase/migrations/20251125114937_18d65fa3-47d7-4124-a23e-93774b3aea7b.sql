-- Allow guests to view their own pending bookings during checkout
-- This fixes the "No services found for booking" bug by allowing the booking_services 
-- RLS policy's EXISTS subquery to succeed for anonymous users

CREATE POLICY "Enable guest booking viewing during checkout" 
ON public.bookings
FOR SELECT 
USING (
  -- Guest booking during checkout (payment_pending status)
  (customer_id IS NULL AND status = 'payment_pending'::booking_status)
  -- Or guest booking with payment intent (post-authorization)
  OR (customer_id IS NULL AND payment_intent_id IS NOT NULL)
);