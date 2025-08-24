-- Resource optimization: Add database-level uniqueness and performance indexes

-- 1. Add unique constraint to prevent duplicate emails at database level
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_email_logs_unique_sent
ON public.email_logs (booking_id, recipient_email, email_type)
WHERE status = 'sent';

-- 2. Add performance indexes for common lookup patterns
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_email_logs_booking_status
ON public.email_logs (booking_id, status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_email_logs_recipient_type
ON public.email_logs (recipient_email, email_type, status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sms_logs_booking_status
ON public.sms_logs (booking_id, status);

-- 3. Add index for idempotency lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_idempotency_operation_status
ON public.idempotency_records (operation_type, status, expires_at);

-- 4. Optimize booking queries with worker assignment
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bookings_worker_status
ON public.bookings (worker_id, status) 
WHERE worker_id IS NOT NULL;

-- 5. Add constraint to ensure email uniqueness per booking-recipient-type
ALTER TABLE public.email_logs 
ADD CONSTRAINT unique_successful_email_per_booking_recipient_type
EXCLUDE (booking_id WITH =, recipient_email WITH =, email_type WITH =)
WHERE (status = 'sent');