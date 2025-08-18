-- Add email_type to email_logs for idempotency
ALTER TABLE public.email_logs 
ADD COLUMN email_type TEXT DEFAULT 'general';

-- Create index for better performance on email_type queries
CREATE INDEX idx_email_logs_email_type ON public.email_logs(email_type);
CREATE INDEX idx_email_logs_booking_email_type ON public.email_logs(booking_id, email_type);

-- Function to send payment pending notification
CREATE OR REPLACE FUNCTION public.send_payment_pending_notification()
RETURNS TRIGGER AS $$
BEGIN
  -- Only send for new bookings with pending payment status
  IF NEW.payment_status = 'pending' OR NEW.payment_status IS NULL THEN
    -- Check if notification already sent to prevent duplicates
    IF NOT EXISTS (
      SELECT 1 FROM public.email_logs 
      WHERE booking_id = NEW.id 
      AND email_type = 'payment_pending'
    ) THEN
      -- Call the payment pending notice edge function
      PERFORM net.http_post(
        url := 'https://ggvplltpwsnvtcbpazbe.supabase.co/functions/v1/send-payment-pending-notice',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdndnBsbHRwd3NudnRjYnBhemJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk1MTU5NjIsImV4cCI6MjA2NTA5MTk2Mn0.cbZ4kBKP7odpP9r1Qrg4G6CA8XdW7vLdKsqr6gE0j_Q'
        ),
        body := jsonb_build_object(
          'bookingId', NEW.id,
          'trigger', 'booking_pending_payment'
        )
      );
    END IF;
  END IF;
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log error but don't fail the main operation
  INSERT INTO public.sms_logs (booking_id, recipient_number, message, status, error_message)
  VALUES (NEW.id, 'system', 'Payment pending notification trigger failed', 'failed', SQLERRM);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for payment pending notifications
DROP TRIGGER IF EXISTS trigger_payment_pending_notification ON public.bookings;
CREATE TRIGGER trigger_payment_pending_notification
  AFTER INSERT ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.send_payment_pending_notification();

-- Auto-cancel pending bookings after 10 minutes
-- First enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule job to cancel expired pending bookings every 2 minutes
SELECT cron.schedule(
  'cancel-expired-pending-bookings',
  '*/2 * * * *', -- Every 2 minutes
  $$
  UPDATE public.bookings 
  SET status = 'cancelled'::booking_status,
      updated_at = now()
  WHERE status = 'pending'::booking_status 
    AND payment_status = 'pending'
    AND created_at < now() - INTERVAL '10 minutes'
    AND status != 'cancelled'; -- Prevent unnecessary updates
  $$
);

-- Log the scheduling
INSERT INTO public.sms_logs (booking_id, recipient_number, message, status, error_message)
VALUES (NULL, 'system', 'Auto-cancel job scheduled for pending bookings (10 min expiry)', 'sent', NULL);