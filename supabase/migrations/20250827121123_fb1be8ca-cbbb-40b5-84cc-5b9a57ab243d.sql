-- Add unique partial indexes to prevent duplicate emails and idempotency records

-- Prevent duplicate emails for the same booking and recipient
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_logs_unique_booking_recipient 
ON email_logs (booking_id, recipient_email, email_type) 
WHERE status = 'sent';

-- Prevent duplicate active idempotency records (simplified without time check)
CREATE UNIQUE INDEX IF NOT EXISTS idx_idempotency_unique_active 
ON idempotency_records (idempotency_key, operation_type, user_id) 
WHERE status IN ('pending', 'completed');

-- Add index for faster cleanup queries  
CREATE INDEX IF NOT EXISTS idx_idempotency_cleanup 
ON idempotency_records (expires_at);

-- Add index for email deduplication queries
CREATE INDEX IF NOT EXISTS idx_email_logs_dedup 
ON email_logs (booking_id, recipient_email, email_type, status, created_at);