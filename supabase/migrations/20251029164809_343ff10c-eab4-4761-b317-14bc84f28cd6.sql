-- Fix booking confirmation email trigger to call correct edge function
-- This migration corrects the function name from 'send-customer-booking-confirmation' 
-- to 'send-customer-booking-confirmation-email' which is the actual deployed function

CREATE OR REPLACE FUNCTION public.trigger_booking_notifications()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  base_url text;
  service_role_key text;
  auth_header text;
  url text;
  payload jsonb;
  should_send_confirmation boolean := false;
  should_send_worker_assignment boolean := false;
  http_response int;
BEGIN
  -- Get Supabase URL and service role key from environment
  base_url := current_setting('app.settings.supabase_url', true);
  service_role_key := current_setting('app.settings.supabase_service_role_key', true);
  
  IF base_url IS NULL THEN
    base_url := 'https://ggvplltpwsnvtcbpazbe.supabase.co';
  END IF;

  -- Determine which emails to send based on status changes
  -- Customer confirmation: send when payment authorized AND worker assigned
  IF (NEW.payment_status IN ('authorized', 'completed', 'captured') 
      AND NEW.worker_id IS NOT NULL 
      AND COALESCE(NEW.confirmation_email_sent, false) = false) THEN
    should_send_confirmation := true;
  END IF;

  -- Worker assignment: send when worker newly assigned
  IF (NEW.worker_id IS NOT NULL 
      AND (OLD.worker_id IS NULL OR OLD.worker_id != NEW.worker_id)
      AND COALESCE(NEW.worker_assignment_email_sent, false) = false) THEN
    should_send_worker_assignment := true;
  END IF;

  -- Send customer confirmation email
  IF should_send_confirmation THEN
    url := base_url || '/functions/v1/send-customer-booking-confirmation-email';
    payload := jsonb_build_object('bookingId', NEW.id);
    
    INSERT INTO sms_logs (phone_number, message, status)
    VALUES ('SYSTEM', 'Confirmation email triggered for booking: ' || NEW.id, 'sent');

    BEGIN
      SELECT status INTO http_response
      FROM net.http_post(
        url := url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdndnBsbHRwd3NudnRjYnBhemJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk1MTU5NjIsImV4cCI6MjA2NTA5MTk2Mn0.cbZ4kBKP7odpP9r1Qrg4G6CA8XdW7vLdKsqr6gE0j_Q'
        ),
        body := payload
      );

      IF http_response BETWEEN 200 AND 299 THEN
        NEW.confirmation_email_sent := true;
      END IF;

    EXCEPTION WHEN OTHERS THEN
      INSERT INTO sms_logs (phone_number, message, status)
      VALUES ('SYSTEM', 'Failed to trigger confirmation email: ' || SQLERRM, 'failed');
    END;
  END IF;

  -- Send worker assignment email
  IF should_send_worker_assignment THEN
    url := base_url || '/functions/v1/send-worker-assignment-notification';
    payload := jsonb_build_object('bookingId', NEW.id, 'workerId', NEW.worker_id);
    
    INSERT INTO sms_logs (phone_number, message, status)
    VALUES ('SYSTEM', 'Worker assignment email triggered for booking: ' || NEW.id, 'sent');

    BEGIN
      SELECT status INTO http_response
      FROM net.http_post(
        url := url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdndnBsbHRwd3NudnRjYnBhemJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk1MTU5NjIsImV4cCI6MjA2NTA5MTk2Mn0.cbZ4kBKP7odpP9r1Qrg4G6CA8XdW7vLdKsqr6gE0j_Q'
        ),
        body := payload
      );

      IF http_response BETWEEN 200 AND 299 THEN
        NEW.worker_assignment_email_sent := true;
      END IF;

    EXCEPTION WHEN OTHERS THEN
      INSERT INTO sms_logs (phone_number, message, status)
      VALUES ('SYSTEM', 'Failed to trigger worker assignment email: ' || SQLERRM, 'failed');
    END;
  END IF;

  RETURN NEW;
END;
$$;