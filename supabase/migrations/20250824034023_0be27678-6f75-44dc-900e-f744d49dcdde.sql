-- Resource optimization: Add database-level uniqueness and performance indexes

-- 1. Add unique constraint to prevent duplicate emails at database level
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_logs_unique_sent
ON public.email_logs (booking_id, recipient_email, email_type)
WHERE status = 'sent';

-- 2. Add performance indexes for common lookup patterns
CREATE INDEX IF NOT EXISTS idx_email_logs_booking_status
ON public.email_logs (booking_id, status);

CREATE INDEX IF NOT EXISTS idx_email_logs_recipient_type
ON public.email_logs (recipient_email, email_type, status);

CREATE INDEX IF NOT EXISTS idx_sms_logs_booking_status
ON public.sms_logs (booking_id, status);

-- 3. Add index for idempotency lookups
CREATE INDEX IF NOT EXISTS idx_idempotency_operation_status
ON public.idempotency_records (operation_type, status, expires_at);

-- 4. Optimize booking queries with worker assignment
CREATE INDEX IF NOT EXISTS idx_bookings_worker_status
ON public.bookings (worker_id, status) 
WHERE worker_id IS NOT NULL;