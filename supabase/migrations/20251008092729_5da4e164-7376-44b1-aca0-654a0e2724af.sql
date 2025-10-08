-- Phase 1: Emergency SMS System Fixes (Fixed)
-- Fix sms_logs schema and add proper phone validation

-- Step 1: Add missing 'pending' status to sms_status enum
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'pending' AND enumtypid = 'sms_status'::regtype) THEN
    ALTER TYPE sms_status ADD VALUE 'pending';
  END IF;
END $$;

-- Step 2: Create phone validation function for database triggers
CREATE OR REPLACE FUNCTION format_phone_e164(phone_input text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
  -- Return null for empty input
  IF phone_input IS NULL OR phone_input = '' THEN
    RETURN NULL;
  END IF;
  
  -- Remove all non-digit characters
  phone_input := regexp_replace(phone_input, '[^\d]', '', 'g');
  
  -- Validate minimum length
  IF length(phone_input) < 10 THEN
    RETURN NULL;
  END IF;
  
  -- Handle 10-digit US numbers (add +1 prefix)
  IF length(phone_input) = 10 THEN
    RETURN '+1' || phone_input;
  END IF;
  
  -- Handle 11-digit numbers starting with 1 (US numbers)
  IF length(phone_input) = 11 AND substring(phone_input, 1, 1) = '1' THEN
    RETURN '+' || phone_input;
  END IF;
  
  -- For other formats, add + prefix
  RETURN '+' || phone_input;
END;
$$;

-- Step 3: Update existing phone numbers to E.164 format
UPDATE sms_logs 
SET recipient_number = format_phone_e164(recipient_number)
WHERE recipient_number NOT IN ('error', 'system', 'trigger', 'admin')
  AND recipient_number !~ '^\+[1-9]\d{1,14}$'
  AND recipient_number IS NOT NULL;

-- Step 4: Add constraint to ensure phone numbers are in E.164 format
ALTER TABLE sms_logs 
ADD CONSTRAINT check_phone_e164_format 
CHECK (
  recipient_number ~ '^\+[1-9]\d{1,14}$' OR 
  recipient_number IN ('error', 'system', 'trigger', 'admin')
);

-- Step 5: Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_sms_logs_booking_status 
ON sms_logs(booking_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sms_logs_recipient 
ON sms_logs(recipient_number, created_at DESC);

-- Step 6: Create view for SMS analytics
CREATE OR REPLACE VIEW v_sms_delivery_stats AS
SELECT 
  DATE(created_at) as date,
  status,
  COUNT(*) as count,
  COUNT(*) FILTER (WHERE status = 'sent') * 100.0 / NULLIF(COUNT(*), 0) as success_rate
FROM sms_logs
WHERE recipient_number NOT IN ('error', 'system', 'trigger', 'admin')
GROUP BY DATE(created_at), status
ORDER BY date DESC, status;