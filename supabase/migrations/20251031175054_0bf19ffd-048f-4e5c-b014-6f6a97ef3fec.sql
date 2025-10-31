-- Fix all 3 critical issues: column name bug, trigger, and worker data

-- ==========================================
-- ISSUE #1: Fix column name from phone_number to recipient_number
-- ==========================================

-- Fix trigger_booking_notifications function
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
    
    -- FIXED: Changed phone_number to recipient_number
    INSERT INTO sms_logs (recipient_number, message, status)
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
      -- FIXED: Changed phone_number to recipient_number
      INSERT INTO sms_logs (recipient_number, message, status)
      VALUES ('SYSTEM', 'Failed to trigger confirmation email: ' || SQLERRM, 'failed');
    END;
  END IF;

  -- Send worker assignment email
  IF should_send_worker_assignment THEN
    url := base_url || '/functions/v1/send-worker-assignment-notification';
    payload := jsonb_build_object('bookingId', NEW.id, 'workerId', NEW.worker_id);
    
    -- FIXED: Changed phone_number to recipient_number
    INSERT INTO sms_logs (recipient_number, message, status)
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
      -- FIXED: Changed phone_number to recipient_number
      INSERT INTO sms_logs (recipient_number, message, status)
      VALUES ('SYSTEM', 'Failed to trigger worker assignment email: ' || SQLERRM, 'failed');
    END;
  END IF;

  RETURN NEW;
END;
$$;

-- ==========================================
-- ISSUE #2: Fix email notification trigger to support payment_authorized status
-- ==========================================

CREATE OR REPLACE FUNCTION public.notify_worker_email_on_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- FIXED: Now triggers for both 'confirmed' AND 'payment_authorized' statuses
  IF OLD.worker_id IS NULL AND NEW.worker_id IS NOT NULL AND NEW.status IN ('confirmed', 'payment_authorized') THEN
    -- Call the worker assignment notification function asynchronously
    PERFORM net.http_post(
      url := 'https://ggvplltpwsnvtcbpazbe.supabase.co/functions/v1/send-worker-assignment-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdndnBsbHRwd3NudnRjYnBhemJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk1MTU5NjIsImV4cCI6MjA2NTA5MTk2Mn0.cbZ4kBKP7odpP9r1Qrg4G6CA8XdW7vLdKsqr6gE0j_Q'
      ),
      body := jsonb_build_object(
        'bookingId', NEW.id::text,
        'workerId', NEW.worker_id::text,
        'force', true
      )
    );
    
    -- Log the trigger action
    INSERT INTO public.sms_logs (booking_id, recipient_number, message, status, error_message)
    VALUES (NEW.id, 'system', 'Auto-trigger: Worker assignment email initiated', 'sent', NULL);
  END IF;
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log error but don't fail the booking update
  INSERT INTO public.sms_logs (booking_id, recipient_number, message, status, error_message)
  VALUES (NEW.id, 'system', 'Auto-trigger: Worker assignment email failed', 'failed', SQLERRM);
  RETURN NEW;
END;
$function$;

-- ==========================================
-- ISSUE #3: Add worker availability data for ANKIT and Michael
-- ==========================================

-- Get worker IDs
DO $$
DECLARE
  ankit_id uuid;
  michael_id uuid;
BEGIN
  -- Find ANKIT's ID
  SELECT id INTO ankit_id FROM users WHERE UPPER(name) LIKE '%ANKIT%' AND role = 'worker' LIMIT 1;
  
  -- Find Michael's ID
  SELECT id INTO michael_id FROM users WHERE UPPER(name) LIKE '%MICHAEL%' AND role = 'worker' LIMIT 1;

  -- Add weekly availability for ANKIT (Monday-Friday, 8 AM - 6 PM)
  IF ankit_id IS NOT NULL THEN
    DELETE FROM worker_availability WHERE worker_id = ankit_id;
    
    INSERT INTO worker_availability (worker_id, day_of_week, start_time, end_time)
    VALUES 
      (ankit_id, 'Monday', '08:00:00', '18:00:00'),
      (ankit_id, 'Tuesday', '08:00:00', '18:00:00'),
      (ankit_id, 'Wednesday', '08:00:00', '18:00:00'),
      (ankit_id, 'Thursday', '08:00:00', '18:00:00'),
      (ankit_id, 'Friday', '08:00:00', '18:00:00'),
      (ankit_id, 'Saturday', '09:00:00', '17:00:00');
    
    RAISE NOTICE 'Added availability for ANKIT (worker_id: %)', ankit_id;
  ELSE
    RAISE WARNING 'Could not find ANKIT worker';
  END IF;

  -- Add weekly availability for Michael (Monday-Saturday, 8 AM - 6 PM)
  IF michael_id IS NOT NULL THEN
    DELETE FROM worker_availability WHERE worker_id = michael_id;
    
    INSERT INTO worker_availability (worker_id, day_of_week, start_time, end_time)
    VALUES 
      (michael_id, 'Monday', '08:00:00', '18:00:00'),
      (michael_id, 'Tuesday', '08:00:00', '18:00:00'),
      (michael_id, 'Wednesday', '08:00:00', '18:00:00'),
      (michael_id, 'Thursday', '08:00:00', '18:00:00'),
      (michael_id, 'Friday', '08:00:00', '18:00:00'),
      (michael_id, 'Saturday', '09:00:00', '17:00:00');
    
    RAISE NOTICE 'Added availability for Michael (worker_id: %)', michael_id;
  ELSE
    RAISE WARNING 'Could not find Michael worker';
  END IF;
END $$;