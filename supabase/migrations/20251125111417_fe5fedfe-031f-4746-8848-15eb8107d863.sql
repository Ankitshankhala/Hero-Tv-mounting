-- Drop the problematic policy if it still exists
DROP POLICY IF EXISTS "Enable guest booking services viewing" ON public.booking_services;

-- Create fixed policy that allows guest checkout flow
CREATE POLICY "Enable guest booking services viewing" ON public.booking_services
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.bookings b 
    WHERE b.id = booking_services.booking_id 
    AND (
      -- Guest booking during checkout (payment_pending status) - CRITICAL FIX
      (b.customer_id IS NULL AND b.status = 'payment_pending')
      -- Guest booking with completed payment
      OR (b.customer_id IS NULL AND b.payment_intent_id IS NOT NULL)
      -- Worker assigned to booking
      OR (b.worker_id = auth.uid())
      -- Admin user
      OR ((auth.uid() IS NOT NULL) AND (get_current_user_role() = 'admin'))
    )
  )
);