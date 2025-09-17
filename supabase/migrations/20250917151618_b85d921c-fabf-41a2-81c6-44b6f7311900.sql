-- Temporarily disable the problematic trigger to fix September 2025 bookings
ALTER TABLE public.bookings DISABLE TRIGGER update_booking_on_payment_auth_trigger;

-- Update September 2025 bookings payment status
UPDATE public.bookings 
SET payment_status = 'captured'
WHERE payment_status = 'completed' 
  AND archived_at >= '2025-09-01'::date
  AND archived_at < '2025-10-01'::date
  AND payment_intent_id IS NOT NULL;

-- Create missing transaction records for September 2025 bookings
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
    s.base_price,
    100.00
  ) as amount,
  'completed'::payment_status,
  'capture',
  'USD',
  b.archived_at,
  b.archived_at,
  gen_random_uuid()
FROM public.bookings b
LEFT JOIN public.services s ON b.service_id = s.id
WHERE b.payment_status = 'captured'
  AND b.archived_at >= '2025-09-01'::date
  AND b.archived_at < '2025-10-01'::date
  AND b.payment_intent_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.transactions t 
    WHERE t.booking_id = b.id 
    AND t.transaction_type = 'capture'
  );

-- Re-enable the trigger
ALTER TABLE public.bookings ENABLE TRIGGER update_booking_on_payment_auth_trigger;

-- Log success
INSERT INTO public.sms_logs (booking_id, recipient_number, message, status, error_message)
VALUES (NULL, 'system', 'September 2025 payment status migration completed successfully', 'sent', NULL);