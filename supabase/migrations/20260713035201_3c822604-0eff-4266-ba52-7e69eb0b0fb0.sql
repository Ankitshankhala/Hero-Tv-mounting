DROP POLICY IF EXISTS "Enable guest booking viewing during checkout" ON public.bookings;

CREATE POLICY "Anon can view own guest booking during active checkout"
ON public.bookings
FOR SELECT
TO anon
USING (
  customer_id IS NULL
  AND status = 'payment_pending'
  AND reservation_expires_at IS NOT NULL
  AND reservation_expires_at > now()
);