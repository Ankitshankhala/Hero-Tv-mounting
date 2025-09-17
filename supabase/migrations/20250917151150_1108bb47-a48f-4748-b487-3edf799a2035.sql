-- Fix September 2025 archived bookings payment status and create missing transactions
-- Step 1: Update payment_status from 'completed' to 'captured' for September 2025 bookings
UPDATE public.bookings 
SET payment_status = 'captured'
WHERE payment_status = 'completed' 
  AND archived_at >= '2025-09-01 00:00:00'::timestamp with time zone
  AND archived_at < '2025-10-01 00:00:00'::timestamp with time zone
  AND payment_intent_id IS NOT NULL;

-- Step 2: Create missing transaction records for these September 2025 bookings
INSERT INTO public.transactions (
  booking_id,
  payment_intent_id,
  amount,
  status,
  transaction_type,
  currency,
  created_at,
  captured_at,
  idempotency_key
)
SELECT 
  b.id as booking_id,
  b.payment_intent_id,
  COALESCE(
    (SELECT SUM(bs.base_price * bs.quantity) 
     FROM booking_services bs 
     WHERE bs.booking_id = b.id),
    s.base_price
  ) as amount,
  'completed'::payment_status as status,
  'capture' as transaction_type,
  'USD' as currency,
  b.archived_at as created_at,
  b.archived_at as captured_at,
  gen_random_uuid() as idempotency_key
FROM public.bookings b
LEFT JOIN public.services s ON b.service_id = s.id
WHERE b.payment_status = 'captured'
  AND b.archived_at >= '2025-09-01 00:00:00'::timestamp with time zone  
  AND b.archived_at < '2025-10-01 00:00:00'::timestamp with time zone
  AND b.payment_intent_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.transactions t 
    WHERE t.booking_id = b.id 
    AND t.transaction_type = 'capture'
  );

-- Log the migration completion
INSERT INTO public.sms_logs (booking_id, recipient_number, message, status, error_message)
VALUES (NULL, 'system', 'September 2025 bookings payment status migration completed', 'sent', NULL);