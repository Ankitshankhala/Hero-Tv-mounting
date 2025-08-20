
BEGIN;

-- 1) Mark as Payment Captured (via Stripe)
-- Bookings: keep completed as-is; otherwise set to confirmed. Always set payment_status captured.
UPDATE public.bookings b
SET 
  payment_status = 'captured',
  status = CASE 
             WHEN b.status <> 'completed' THEN 'confirmed'::booking_status 
             ELSE b.status 
           END,
  updated_at = now()
WHERE b.id IN (
  '7b488b56-3b36-4057-80c4-2f8d7b8db288',
  '11d71f72-1c1c-4b40-84fd-04817e774831'
);

-- Transactions: update the latest transaction per booking to capture/complete
WITH latest_tx AS (
  SELECT DISTINCT ON (t.booking_id) t.id
  FROM public.transactions t
  WHERE t.booking_id IN (
    '7b488b56-3b36-4057-80c4-2f8d7b8db288',
    '11d71f72-1c1c-4b40-84fd-04817e774831'
  )
  ORDER BY t.booking_id, t.created_at DESC
)
UPDATE public.transactions t
SET 
  status = 'completed',
  transaction_type = 'capture',
  captured_at = now()
FROM latest_tx lt
WHERE t.id = lt.id;

-- Audit log entries for captured bookings
INSERT INTO public.booking_audit_log (booking_id, operation, status, details, created_at)
SELECT b.id, 
       'payment_capture_manual', 
       'success', 
       jsonb_build_object(
         'note', 'Manual update: Payment Captured (via Stripe)',
         'stripe_reference', 'manual-update-no-stripe-ref-provided'
       ),
       now()
FROM public.bookings b
WHERE b.id IN (
  '7b488b56-3b36-4057-80c4-2f8d7b8db288',
  '11d71f72-1c1c-4b40-84fd-04817e774831'
);

-- 2) Mark as Payment Canceled & Refunded
-- Bookings: set payment_status failed; do not change booking.status here
UPDATE public.bookings b
SET 
  payment_status = 'failed',
  updated_at = now()
WHERE b.id IN (
  '5f857ca3-efea-4253-b66b-94ebe6478bfb',
  '7ff8fd9b-b3e4-4ffa-b986-a9551ace5f9a',
  '0fdac303-53af-4de9-9cbb-5d0d6ec3ab24',
  'a33df3f1-9ea9-4188-99a0-819eb369caaf'
);

-- Transactions: update the latest transaction per booking to failed and set refund fields
WITH latest_tx_refund AS (
  SELECT DISTINCT ON (t.booking_id) t.id, t.amount
  FROM public.transactions t
  WHERE t.booking_id IN (
    '5f857ca3-efea-4253-b66b-94ebe6478bfb',
    '7ff8fd9b-b3e4-4ffa-b986-a9551ace5f9a',
    '0fdac303-53af-4de9-9cbb-5d0d6ec3ab24',
    'a33df3f1-9ea9-4188-99a0-819eb369caaf'
  )
  ORDER BY t.booking_id, t.created_at DESC
)
UPDATE public.transactions t
SET 
  status = 'failed',
  cancelled_at = now(),
  cancellation_reason = 'manual_refund',
  refund_amount = COALESCE(t.refund_amount, ltr.amount),
  stripe_refund_id = COALESCE(t.stripe_refund_id, 'manual-refund-no-stripe-ref-provided')
FROM latest_tx_refund ltr
WHERE t.id = ltr.id;

-- Audit log entries for refunded bookings
INSERT INTO public.booking_audit_log (booking_id, operation, status, details, created_at)
SELECT b.id, 
       'payment_cancelled_refunded_manual', 
       'success', 
       jsonb_build_object(
         'note', 'Manual update: Payment Canceled & Refunded',
         'stripe_reference', 'manual-refund-no-stripe-ref-provided'
       ),
       now()
FROM public.bookings b
WHERE b.id IN (
  '5f857ca3-efea-4253-b66b-94ebe6478bfb',
  '7ff8fd9b-b3e4-4ffa-b986-a9551ace5f9a',
  '0fdac303-53af-4de9-9cbb-5d0d6ec3ab24',
  'a33df3f1-9ea9-4188-99a0-819eb369caaf'
);

COMMIT;
