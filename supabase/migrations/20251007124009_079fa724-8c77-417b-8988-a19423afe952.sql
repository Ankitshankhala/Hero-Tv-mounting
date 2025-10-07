
-- Drop the broken function and all dependent triggers using CASCADE
DROP FUNCTION IF EXISTS public.update_booking_on_payment_auth() CASCADE;

-- Backfill missing transactions for September and October 2025
INSERT INTO public.transactions (
  booking_id,
  amount,
  status,
  currency,
  transaction_type,
  payment_intent_id,
  payment_method,
  guest_customer_email,
  created_at
)
SELECT 
  b.id as booking_id,
  COALESCE(
    (SELECT SUM(bs.base_price * bs.quantity) 
     FROM booking_services bs 
     WHERE bs.booking_id = b.id),
    (SELECT s.base_price 
     FROM services s 
     WHERE s.id = b.service_id),
    150.00
  ) as amount,
  CASE 
    WHEN b.payment_status = 'completed' THEN 'completed'::payment_status
    WHEN b.payment_status = 'authorized' THEN 'authorized'::payment_status
    WHEN b.payment_status = 'captured' THEN 'completed'::payment_status
    WHEN b.payment_status = 'pending' THEN 'pending'::payment_status
    ELSE 'pending'::payment_status
  END as status,
  'USD' as currency,
  CASE 
    WHEN b.payment_status IN ('completed', 'captured') THEN 'capture'
    WHEN b.payment_status = 'authorized' THEN 'authorization'
    ELSE 'charge'
  END as transaction_type,
  b.payment_intent_id,
  'card' as payment_method,
  COALESCE(
    (b.guest_customer_info->>'email'),
    (SELECT u.email FROM users u WHERE u.id = b.customer_id)
  ) as guest_customer_email,
  b.created_at
FROM public.bookings b
WHERE b.payment_intent_id IS NOT NULL
  AND b.created_at >= '2025-09-01'
  AND b.created_at < '2025-11-01'
  AND NOT EXISTS (
    SELECT 1 FROM public.transactions t 
    WHERE t.booking_id = b.id
  );
