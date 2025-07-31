-- Fix guest booking update policy to allow payment_pending bookings to be updated
DROP POLICY IF EXISTS "Enable guest booking updates" ON public.bookings;

CREATE POLICY "Enable guest booking updates" 
ON public.bookings 
FOR UPDATE 
USING (
  ((customer_id IS NULL) AND ((payment_intent_id IS NOT NULL) OR (status = 'payment_pending'))) 
  OR (worker_id = auth.uid()) 
  OR ((auth.uid() IS NOT NULL) AND (get_current_user_role() = 'admin'::text))
);