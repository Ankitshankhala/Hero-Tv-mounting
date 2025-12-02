-- Phase 1: SMS System Parity with Email System

-- 1. Add sms_type column to sms_logs (like email_type in email_logs)
ALTER TABLE public.sms_logs 
ADD COLUMN IF NOT EXISTS sms_type text DEFAULT 'general';

-- 2. Add worker_sms_sent flag to bookings (like worker_assignment_email_sent)
ALTER TABLE public.bookings 
ADD COLUMN IF NOT EXISTS worker_sms_sent boolean NOT NULL DEFAULT false;

-- 3. Update existing real SMS logs to have proper sms_type
UPDATE public.sms_logs
SET sms_type = 'worker_assignment'
WHERE recipient_number LIKE '+%' 
  AND sms_type IS NULL OR sms_type = 'general';

-- 4. Update existing system/audit logs
UPDATE public.sms_logs
SET sms_type = 'system_audit'
WHERE recipient_number IN ('system', 'trigger', 'manual', 'admin', 'SYSTEM', 'error')
  AND (sms_type IS NULL OR sms_type = 'general');

-- 5. Backfill worker_sms_sent flag for bookings that have successful SMS logs
UPDATE public.bookings b
SET worker_sms_sent = true
WHERE EXISTS (
  SELECT 1 FROM public.sms_logs s
  WHERE s.booking_id = b.id
    AND s.status = 'sent'
    AND s.recipient_number LIKE '+%'
    AND s.twilio_sid IS NOT NULL
)
AND b.worker_sms_sent = false;

-- 6. Create index for faster SMS lookups
CREATE INDEX IF NOT EXISTS idx_sms_logs_type ON public.sms_logs(sms_type);
CREATE INDEX IF NOT EXISTS idx_sms_logs_booking_status ON public.sms_logs(booking_id, status);

-- 7. Update resend_worker_sms function to respect the new flag
CREATE OR REPLACE FUNCTION public.resend_worker_sms(booking_id_param uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_sms_enabled() THEN
    -- Call the send-sms-notification edge function using net.http_post
    PERFORM net.http_post(
      url := 'https://ggvplltpwsnvtcbpazbe.supabase.co/functions/v1/send-sms-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdndnBsbHRwd3NudnRjYnBhemJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk1MTU5NjIsImV4cCI6MjA2NTA5MTk2Mn0.cbZ4kBKP7odpP9r1Qrg4G6CA8XdW7vLdKsqr6gE0j_Q'
      ),
      body := jsonb_build_object('bookingId', booking_id_param::text, 'force', true)
    );
    
    -- Log the manual SMS trigger
    INSERT INTO sms_logs (booking_id, recipient_number, message, status, error_message, sms_type)
    VALUES (booking_id_param, 'manual', 'Manual SMS resend triggered', 'sent', NULL, 'manual_resend');
    
    RETURN TRUE;
  ELSE
    -- Log that SMS is disabled
    INSERT INTO sms_logs (booking_id, recipient_number, message, status, error_message, sms_type)
    VALUES (booking_id_param, 'manual', 'Manual SMS resend skipped - SMS disabled', 'pending', NULL, 'manual_resend');
    RETURN FALSE;
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- Log error
  INSERT INTO sms_logs (booking_id, recipient_number, message, status, error_message, sms_type)
  VALUES (booking_id_param, 'manual', 'Manual SMS resend failed', 'failed', SQLERRM, 'manual_resend');
  RETURN FALSE;
END;
$$;