-- Expand allowed operation types for idempotency to support email sends
ALTER TABLE public.idempotency_records
  DROP CONSTRAINT IF EXISTS idempotency_records_operation_type_check;

ALTER TABLE public.idempotency_records
  ADD CONSTRAINT idempotency_records_operation_type_check
  CHECK (operation_type IN (
    'booking_create', 'payment_intent', 'payment_confirm',
    'email_send_worker_assignment', 'email_send_customer_confirmation'
  ));

-- Optional: strengthen uniqueness to include user scope if not already present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE schemaname = 'public' 
      AND indexname = 'idx_idempotency_key_operation_user'
  ) THEN
    CREATE UNIQUE INDEX idx_idempotency_key_operation_user
    ON public.idempotency_records (idempotency_key, operation_type, user_id);
  END IF;
END $$;