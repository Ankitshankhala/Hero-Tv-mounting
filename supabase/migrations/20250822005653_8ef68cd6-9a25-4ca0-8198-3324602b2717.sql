-- Create email deduplication system without modifying cron jobs
-- This establishes the core deduplication functionality

-- Create improved retry function that uses smart dispatcher
CREATE OR REPLACE FUNCTION public.retry_unsent_notifications_v2(p_lookback_minutes integer DEFAULT 30, p_grace_minutes integer DEFAULT 5)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  b record;
  results jsonb := '{"checked":0,"resends":0,"errors":0,"details":[]}'::jsonb;
  message_text text;
BEGIN
  -- Log that we're using the new deduplication-aware retry system
  INSERT INTO public.sms_logs (booking_id, recipient_number, message, status, error_message)
  VALUES (NULL, 'system', 'Starting deduplication-aware retry check', 'sent', NULL);

  FOR b IN
    SELECT *
    FROM public.bookings
    WHERE created_at BETWEEN now() - make_interval(mins => p_lookback_minutes)
                         AND     now() - make_interval(mins => p_grace_minutes)
      AND status = 'confirmed'
      AND (payment_status IN ('authorized','completed','captured'))
  LOOP
    results := jsonb_set(results, '{checked}', ((results->>'checked')::int + 1)::text::jsonb);

    BEGIN
      message_text := 'Dedup Retry:';

      -- Use smart dispatcher for both customer and worker emails
      -- The smart dispatcher will handle all deduplication logic
      
      -- Customer email retry via smart dispatcher
      PERFORM net.http_post(
        url := 'https://ggvplltpwsnvtcbpazbe.supabase.co/functions/v1/smart-email-dispatcher',
        headers := jsonb_build_object(
          'Content-Type','application/json',
          'Authorization','Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdndnBsbHRwd3NudnRjYnBhemJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk1MTU5NjIsImV4cCI6MjA2NTA5MTk2Mn0.cbZ4kBKP7odpP9r1Qrg4G6CA8XdW7vLdKsqr6gE0j_Q'
        ),
        body := jsonb_build_object(
          'bookingId', b.id::text,
          'emailType', 'customer_confirmation',
          'source', 'retry'
        )
      );

      -- Worker email retry via smart dispatcher (only if worker assigned)
      IF b.worker_id IS NOT NULL THEN
        PERFORM net.http_post(
          url := 'https://ggvplltpwsnvtcbpazbe.supabase.co/functions/v1/smart-email-dispatcher',
          headers := jsonb_build_object(
            'Content-Type','application/json',
            'Authorization','Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdndnBsbHRwd3NudnRjYnBhemJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk1MTU5NjIsImV4cCI6MjA2NTA5MTk2Mn0.cbZ4kBKP7odpP9r1Qrg4G6CA8XdW7vLdKsqr6gE0j_Q'
          ),
          body := jsonb_build_object(
            'bookingId', b.id::text,
            'workerId', b.worker_id::text,
            'emailType', 'worker_assignment',
            'source', 'retry'
          )
        );
      END IF;

      message_text := message_text || ' processed customer and worker emails via smart dispatcher';

      -- Log the retry attempt
      INSERT INTO public.sms_logs (booking_id, recipient_number, message, status, error_message)
      VALUES (b.id, 'system', message_text, 'sent', NULL);

      results := jsonb_set(results, '{resends}', ((results->>'resends')::int + 1)::text::jsonb);
      results := jsonb_set(
        results,
        '{details}',
        (results->'details') || jsonb_build_object('booking_id', b.id, 'action', message_text)
      );

    EXCEPTION WHEN OTHERS THEN
      INSERT INTO public.sms_logs (booking_id, recipient_number, message, status, error_message)
      VALUES (b.id, 'system', 'Dedup retry failed', 'failed', SQLERRM);

      results := jsonb_set(results, '{errors}', ((results->>'errors')::int + 1)::text::jsonb);
    END;
  END LOOP;

  RETURN results;
END;
$function$;

-- Create a trigger function that uses smart dispatcher for new worker assignments
CREATE OR REPLACE FUNCTION public.trigger_smart_worker_email()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  -- Only trigger when a worker is newly assigned
  IF NEW.worker_id IS NOT NULL AND OLD.worker_id IS NULL THEN
    -- Use smart email dispatcher to prevent duplicates
    PERFORM net.http_post(
      url := 'https://ggvplltpwsnvtcbpazbe.supabase.co/functions/v1/smart-email-dispatcher',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdndnBsbHRwd3NudnRjYnBhemJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk1MTU5NjIsImV4cCI6MjA2NTA5MTk2Mn0.cbZ4kBKP7odpP9r1Qrg4G6CA8XdW7vLdKsqr6gE0j_Q'
      ),
      body := jsonb_build_object(
        'bookingId', NEW.id::text,
        'workerId', NEW.worker_id::text,
        'emailType', 'worker_assignment',
        'source', 'trigger'
      )
    );
    
    -- Log the trigger
    INSERT INTO sms_logs (booking_id, recipient_number, message, status, error_message)
    VALUES (NEW.id, 'system', 'Smart worker assignment email triggered via database', 'sent', NULL);
  END IF;
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log error but don't fail the main operation
  INSERT INTO sms_logs (booking_id, recipient_number, message, status, error_message)
  VALUES (NEW.id, 'system', 'Smart trigger failed', 'failed', SQLERRM);
  RETURN NEW;
END;
$function$;

-- Remove any existing problematic triggers and create new smart trigger
DROP TRIGGER IF EXISTS trigger_worker_assignment_email ON public.bookings;
DROP TRIGGER IF EXISTS trigger_smart_worker_assignment ON public.bookings;

CREATE TRIGGER trigger_smart_worker_assignment
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION trigger_smart_worker_email();

-- Log the completion
INSERT INTO public.sms_logs (booking_id, recipient_number, message, status, error_message)
VALUES (NULL, 'system', 'Email deduplication system v2 deployed successfully', 'sent', NULL);