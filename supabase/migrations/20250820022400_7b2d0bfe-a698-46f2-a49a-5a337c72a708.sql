
BEGIN;

-- Inputs
-- booking_id: 8d1b49d1-f2a4-44d8-8617-a75977124ba5
-- stripe_payment_intent_id: pi_3Rxt9XCrUPkotWKC1pQnxoND
-- worker_name_for_log: Connor

-- 1) Upsert a capture transaction tied to the provided PaymentIntent.
WITH existing_tx AS (
  SELECT id
  FROM public.transactions
  WHERE payment_intent_id = 'pi_3Rxt9XCrUPkotWKC1pQnxoND'
  LIMIT 1
),
latest_auth AS (
  SELECT id, amount
  FROM public.transactions
  WHERE booking_id = '8d1b49d1-f2a4-44d8-8617-a75977124ba5'
    AND status = 'authorized'
  ORDER BY created_at DESC
  LIMIT 1
),
upsert_capture AS (
  -- Update existing transaction if it exists
  UPDATE public.transactions t
  SET
    status = 'completed',
    transaction_type = 'capture',
    captured_at = now()
  WHERE t.id IN (SELECT id FROM existing_tx)
  RETURNING t.id
),
insert_capture AS (
  -- Insert a new capture transaction if none existed for that PaymentIntent
  INSERT INTO public.transactions (
    booking_id,
    amount,
    status,
    transaction_type,
    payment_method,
    payment_intent_id,
    captured_at
  )
  SELECT
    '8d1b49d1-f2a4-44d8-8617-a75977124ba5'::uuid,
    COALESCE((SELECT amount FROM latest_auth), 0),
    'completed',
    'capture',
    'card',
    'pi_3Rxt9XCrUPkotWKC1pQnxoND',
    now()
  WHERE NOT EXISTS (SELECT 1 FROM upsert_capture)
  RETURNING id
)
SELECT id FROM upsert_capture
UNION ALL
SELECT id FROM insert_capture;

-- 2) Update the booking to completed with payment captured
UPDATE public.bookings
SET
  payment_status = 'captured',
  status = 'completed',
  pending_payment_amount = NULL,
  requires_manual_payment = FALSE,
  has_modifications = FALSE,
  updated_at = now()
WHERE id = '8d1b49d1-f2a4-44d8-8617-a75977124ba5';

-- 3) Add an audit trail entry noting manual confirmation and the Stripe PaymentIntent
INSERT INTO public.booking_audit_log (
  booking_id,
  operation,
  status,
  payment_intent_id,
  details,
  created_at
)
VALUES (
  '8d1b49d1-f2a4-44d8-8617-a75977124ba5'::uuid,
  'payment_capture_manual',
  'success',
  'pi_3Rxt9XCrUPkotWKC1pQnxoND',
  jsonb_build_object(
    'note', 'Manual confirmation: service completed and payment captured via Stripe',
    'worker', 'Connor'
  ),
  now()
);

COMMIT;
