
-- Restore worker assignment email trigger while preserving current customer email logic

-- Ensure pg_net extension is available (idempotent)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Replace the consolidated trigger function to re-add worker email on assignment
CREATE OR REPLACE FUNCTION public.trigger_booking_notifications()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  should_send_payment_pending BOOLEAN := false;
  should_send_confirmation BOOLEAN := false;
  should_send_worker_assignment BOOLEAN := false;
BEGIN
  -- For INSERT operations (new bookings)
  IF TG_OP = 'INSERT' THEN
    -- Always send payment pending email for new bookings
    should_send_payment_pending := true;

    -- If a worker is already set on insert, fire worker assignment notification too
    IF NEW.worker_id IS NOT NULL THEN
      should_send_worker_assignment := true;
    END IF;
  END IF;

  -- For UPDATE operations
  IF TG_OP = 'UPDATE' THEN
    -- 1) Fire worker assignment email when worker_id transitions NULL -> NOT NULL
    IF OLD.worker_id IS NULL AND NEW.worker_id IS NOT NULL THEN
      should_send_worker_assignment := true;
    END IF;

    -- 2) Send customer confirmation email when:
    --    - payment_status becomes authorized/completed/captured OR
    --    - worker_id becomes non-null,
    --    and confirmation email hasn't been sent yet.
    IF (
         (NEW.payment_status IN ('authorized', 'completed', 'captured')
          AND COALESCE(OLD.payment_status, '') NOT IN ('authorized', 'completed', 'captured'))
         OR
         (OLD.worker_id IS NULL AND NEW.worker_id IS NOT NULL)
       )
    THEN
      IF NEW.payment_status IN ('authorized', 'completed', 'captured')
         AND NEW.worker_id IS NOT NULL
         AND COALESCE(NEW.confirmation_email_sent, FALSE) = FALSE
      THEN
        should_send_confirmation := true;
        -- Mark confirmation as sent to avoid duplicates
        NEW.confirmation_email_sent := TRUE;
      END IF;
    END IF;
  END IF;

  -- 3) Execute notifications

  -- Payment pending (customer)
  IF should_send_payment_pending THEN
    PERFORM net.http_post(
      url := 'https://ggvplltpwsnvtcbpazbe.supabase.co/functions/v1/send-payment-pending-notice',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdndnBsbHRwd3NudnRjYnBhemJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk1MTU5NjIsImV4cCI6MjA2NTA5MTk2Mn0.cbZ4kBKP7odpP9r1Qrg4G6CA8XdW7vLdKsqr6gE0j_Q'
      ),
      body := jsonb_build_object(
        'bookingId', NEW.id,
        'trigger', 'payment_pending'
      )
    );

    INSERT INTO public.sms_logs (booking_id, recipient_number, message, status, error_message)
    VALUES (NEW.id, 'system', 'Payment pending email triggered', 'sent', NULL);
  END IF;

  -- Confirmation (customer) when payment is ready AND worker is assigned
  IF should_send_confirmation THEN
    PERFORM net.http_post(
      url := 'https://ggvplltpwsnvtcbpazbe.supabase.co/functions/v1/send-customer-booking-confirmation',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdndnBsbHRwd3NudnRjYnBhemJlIiwicm9zZSI6ImFub24iLCJpYXQiOjE3NDk1MTU5NjIsImV4cCI6MjA2NTA5MTk2Mn0.cbZ4kBKP7odpP9r1Qrg4G6CA8XdW7vLdKsqr6gE0j_Q'
      ),
      body := jsonb_build_object(
        'bookingId', NEW.id,
        'trigger', 'booking_confirmed'
      )
    );

    INSERT INTO public.sms_logs (booking_id, recipient_number, message, status, error_message)
    VALUES (NEW.id, 'system', 'Confirmation email triggered', 'sent', NULL);
  END IF;

  -- Worker assignment (worker) immediately upon assignment
  IF should_send_worker_assignment THEN
    PERFORM net.http_post(
      url := 'https://ggvplltpwsnvtcbpazbe.supabase.co/functions/v1/send-worker-assignment-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdndnBsbHRwd3NudnRjYnBhemJlIiwicm9zZSI6ImFub24iLCJpYXQiOjE3NDk1MTU5NjIsImV4cCI6MjA2NTA5MTk2Mn0.cbZ4kBKP7odpP9r1Qrg4G6CA8XdW7vLdKsqr6gE0j_Q'
      ),
      body := jsonb_build_object(
        'bookingId', NEW.id::text,
        'workerId', NEW.worker_id::text
      )
    );

    INSERT INTO public.sms_logs (booking_id, recipient_number, message, status, error_message)
    VALUES (NEW.id, 'system', 'Worker assignment email triggered', 'sent', NULL);
  END IF;

  RETURN NEW;

EXCEPTION WHEN OTHERS THEN
  -- Log error but don't fail the main operation
  INSERT INTO public.sms_logs (booking_id, recipient_number, message, status, error_message)
  VALUES (COALESCE(NEW.id, NULL), 'system', 'Notification trigger failed', 'failed', SQLERRM);
  RETURN NEW;
END;
$$;

-- Make sure the trigger exists and points to this function
DROP TRIGGER IF EXISTS booking_notifications_trigger ON public.bookings;
CREATE TRIGGER booking_notifications_trigger
  AFTER INSERT OR UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_booking_notifications();
