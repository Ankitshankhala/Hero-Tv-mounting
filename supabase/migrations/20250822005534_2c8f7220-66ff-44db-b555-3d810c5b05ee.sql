-- Update retry_unsent_notifications function to use smart email dispatcher
-- This ensures the retry mechanism also respects deduplication rules

CREATE OR REPLACE FUNCTION public.retry_unsent_notifications_v2(p_lookback_minutes integer DEFAULT 30, p_grace_minutes integer DEFAULT 5)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  b record;
  results jsonb := '{"checked":0,"resends":0,"errors":0,"details":[]}'::jsonb;

  -- Recipient details
  worker_email text;
  worker_phone text;
  customer_email text;
  customer_phone text;

  -- Channel checks
  worker_email_sent boolean := false;
  worker_sms_sent boolean := false;
  customer_email_sent boolean := false;
  customer_sms_sent boolean := false;

  message_text text;
BEGIN
  FOR b IN
    SELECT *
    FROM public.bookings
    WHERE created_at BETWEEN now() - make_interval(mins => p_lookback_minutes)
                         AND     now() - make_interval(mins => p_grace_minutes)
      AND status = 'confirmed'
      AND (payment_status IN ('authorized','completed','captured'))
  LOOP
    results := jsonb_set(results, '{checked}', ((results->>'checked')::int + 1)::text::jsonb);

    -- Resolve worker email/phone (if assigned)
    worker_email := NULL;
    worker_phone := NULL;
    IF b.worker_id IS NOT NULL THEN
      SELECT u.email, u.phone
      INTO worker_email, worker_phone
      FROM public.users u
      WHERE u.id = b.worker_id;
    END IF;

    -- Resolve customer email/phone (registered vs guest)
    IF b.customer_id IS NOT NULL THEN
      SELECT u.email, u.phone
      INTO customer_email, customer_phone
      FROM public.users u
      WHERE u.id = b.customer_id;
    ELSE
      customer_email := COALESCE((b.guest_customer_info->>'email')::text, NULL);
      customer_phone := COALESCE((b.guest_customer_info->>'phone')::text, NULL);
    END IF;

    -- Check per-recipient email delivery after booking creation
    SELECT EXISTS (
      SELECT 1 FROM public.email_logs el
      WHERE el.booking_id = b.id
        AND el.status = 'sent'
        AND worker_email IS NOT NULL
        AND lower(el.recipient_email) = lower(worker_email)
        AND COALESCE(el.sent_at, el.created_at) > b.created_at
    ) INTO worker_email_sent;

    SELECT EXISTS (
      SELECT 1 FROM public.email_logs el
      WHERE el.booking_id = b.id
        AND el.status = 'sent'
        AND customer_email IS NOT NULL
        AND lower(el.recipient_email) = lower(customer_email)
        AND COALESCE(el.sent_at, el.created_at) > b.created_at
    ) INTO customer_email_sent;

    -- Check per-recipient SMS (best-effort by matching phone)
    SELECT EXISTS (
      SELECT 1 FROM public.sms_logs sl
      WHERE sl.booking_id = b.id
        AND sl.status = 'sent'
        AND worker_phone IS NOT NULL
        AND sl.recipient_number = worker_phone
        AND COALESCE(sl.sent_at, sl.created_at) > b.created_at
    ) INTO worker_sms_sent;

    SELECT EXISTS (
      SELECT 1 FROM public.sms_logs sl
      WHERE sl.booking_id = b.id
        AND sl.status = 'sent'
        AND customer_phone IS NOT NULL
        AND sl.recipient_number = customer_phone
        AND COALESCE(sl.sent_at, sl.created_at) > b.created_at
    ) INTO customer_sms_sent;

    -- If both sides have at least one successful channel, skip
    IF (customer_email_sent OR customer_sms_sent)
       AND (b.worker_id IS NULL OR (worker_email_sent OR worker_sms_sent)) THEN
      CONTINUE;
    END IF;

    BEGIN
      message_text := 'Watchdog v2:';

      -- Resend missing customer side using smart dispatcher
      IF NOT (customer_email_sent OR customer_sms_sent) THEN
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
        message_text := message_text || ' re-sent customer email';

        -- Optional: customer SMS when worker assigned and SMS is enabled
        IF public.is_sms_enabled() AND b.worker_id IS NOT NULL THEN
          PERFORM net.http_post(
            url := 'https://ggvplltpwsnvtcbpazbe.supabase.co/functions/v1/send-customer-worker-sms',
            headers := jsonb_build_object(
              'Content-Type','application/json',
              'Authorization','Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdndnBsbHRwd3NudnRjYnBhemJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk1MTU5NjIsImV4cCI6MjA2NTA5MTk2Mn0.cbZ4kBKP7odpP9r1Qrg4G6CA8XdW7vLdKsqr6gE0j_Q'
            ),
            body := jsonb_build_object('bookingId', b.id::text)
          );
          message_text := message_text || ' + customer SMS';
        END IF;
      END IF;

      -- Resend missing worker side using smart dispatcher (only if a worker is assigned)
      IF b.worker_id IS NOT NULL AND NOT (worker_email_sent OR worker_sms_sent) THEN
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
        message_text := message_text || CASE WHEN message_text <> 'Watchdog v2:' THEN '; ' ELSE ' ' END || 're-sent worker email';

        IF public.is_sms_enabled() THEN
          PERFORM net.http_post(
            url := 'https://ggvplltpwsnvtcbpazbe.supabase.co/functions/v1/send-sms-notification',
            headers := jsonb_build_object(
              'Content-Type','application/json',
              'Authorization','Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdndnBsbHRwd3NudnRjYnBhemJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk1MTU5NjIsImV4cCI6MjA2NTA5MTk2Mn0.cbZ4kBKP7odpP9r1Qrg4G6CA8XdW7vLdKsqr6gE0j_Q'
            ),
            body := jsonb_build_object('bookingId', b.id::text)
          );
          message_text := message_text || ' + worker SMS';
        END IF;
      END IF;

      -- If any action was taken, log + update results
      IF message_text <> 'Watchdog v2:' THEN
        INSERT INTO public.sms_logs (booking_id, recipient_number, message, status, error_message)
        VALUES (b.id, 'system', message_text, 'sent', NULL);

        results := jsonb_set(results, '{resends}', ((results->>'resends')::int + 1)::text::jsonb);
        results := jsonb_set(
          results,
          '{details}',
          (results->'details') || jsonb_build_object('booking_id', b.id, 'action', message_text)
        );
      END IF;

    EXCEPTION WHEN OTHERS THEN
      INSERT INTO public.sms_logs (booking_id, recipient_number, message, status, error_message)
      VALUES (b.id, 'system', 'Watchdog v2: resend failed', 'failed', SQLERRM);

      results := jsonb_set(results, '{errors}', ((results->>'errors')::int + 1)::text::jsonb);
      results := jsonb_set(
        results,
        '{details}',
        (results->'details') || jsonb_build_object('booking_id', b.id, 'error', SQLERRM)
      );
    END;
  END LOOP;

  RETURN results;
END;
$function$;

-- Update cron job to use the new retry function
UPDATE cron.job 
SET command = 'SELECT public.retry_unsent_notifications_v2(120, 5);'
WHERE jobname = 'retry-failed-notifications';

-- Log the migration
INSERT INTO public.sms_logs (booking_id, recipient_number, message, status, error_message)
VALUES (NULL, 'system', 'Email deduplication system deployed - all email paths now use smart dispatcher', 'sent', NULL);