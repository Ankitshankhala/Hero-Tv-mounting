
-- Per-booking watchdog that workers/customers can safely trigger for their own booking
CREATE OR REPLACE FUNCTION public.retry_unsent_notifications_for_booking(p_booking_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  b record;
  results jsonb := '{"booking_id": null, "resends": [], "skipped": [], "errors": []}'::jsonb;

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

  is_admin boolean := false;
BEGIN
  -- Fetch booking
  SELECT * INTO b
  FROM public.bookings
  WHERE id = p_booking_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;

  -- Authorization: caller must be booking.customer_id OR booking.worker_id OR admin
  SELECT (u.role = 'admin') INTO is_admin
  FROM public.users u
  WHERE u.id = auth.uid();

  IF NOT is_admin
     AND (auth.uid() IS DISTINCT FROM b.customer_id)
     AND (auth.uid() IS DISTINCT FROM b.worker_id)
  THEN
    RAISE EXCEPTION 'Not authorized to retry notifications for this booking';
  END IF;

  results := jsonb_set(results, '{booking_id}', to_jsonb(b.id::text));

  -- Only proceed for confirmed/completed bookings with authorized/completed/captured payment
  IF b.status NOT IN ('confirmed','completed')
     OR COALESCE((b.payment_status::text), '') NOT IN ('authorized','completed','captured') THEN
    results := jsonb_set(results, '{skipped}', (results->'skipped') || to_jsonb('Booking not eligible (status/payment)'));
    RETURN results;
  END IF;

  -- Resolve worker contact (if assigned)
  IF b.worker_id IS NOT NULL THEN
    SELECT u.email, u.phone
    INTO worker_email, worker_phone
    FROM public.users u
    WHERE u.id = b.worker_id;
  END IF;

  -- Resolve customer contact (registered vs guest)
  IF b.customer_id IS NOT NULL THEN
    SELECT u.email, u.phone
    INTO customer_email, customer_phone
    FROM public.users u
    WHERE u.id = b.customer_id;
  ELSE
    customer_email := COALESCE((b.guest_customer_info->>'email')::text, NULL);
    customer_phone := COALESCE((b.guest_customer_info->>'phone')::text, NULL);
  END IF;

  -- Check existing deliveries after booking creation
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

  -- If both sides already have at least one successful channel, skip
  IF (customer_email_sent OR customer_sms_sent)
     AND (b.worker_id IS NULL OR (worker_email_sent OR worker_sms_sent)) THEN
    results := jsonb_set(results, '{skipped}', (results->'skipped') || to_jsonb('Both sides already notified'));
    RETURN results;
  END IF;

  BEGIN
    -- Customer side
    IF NOT (customer_email_sent OR customer_sms_sent) THEN
      PERFORM net.http_post(
        url := 'https://ggvplltpwsnvtcbpazbe.supabase.co/functions/v1/send-customer-booking-confirmation',
        headers := jsonb_build_object(
          'Content-Type','application/json',
          'Authorization','Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdndnBsbHRwd3NudnRjYnBhemJlIiwicm9zZSI6ImFub24iLCJpYXQiOjE3NDk1MTU5NjIsImV4cCI6MjA2NTA5MTk2Mn0.cbZ4kBKP7odpP9r1Qrg4G6CA8XdW7vLdKsqr6gE0j_Q'
        ),
        body := jsonb_build_object('bookingId', b.id::text)
      );
      results := jsonb_set(results, '{resends}', (results->'resends') || to_jsonb('customer_email'));

      IF public.is_sms_enabled() AND b.worker_id IS NOT NULL AND customer_phone IS NOT NULL THEN
        PERFORM net.http_post(
          url := 'https://ggvplltpwsnvtcbpazbe.supabase.co/functions/v1/send-customer-worker-sms',
          headers := jsonb_build_object(
            'Content-Type','application/json',
            'Authorization','Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdndnBsbHRwd3NudnRjYnBhemJlIiwicm9zZSI6ImFub24iLCJpYXQiOjE3NDk1MTU5NjIsImV4cCI6MjA2NTA5MTk2Mn0.cbZ4kBKP7odpP9r1Qrg4G6CA8XdW7vLdKsqr6gE0j_Q'
          ),
          body := jsonb_build_object('bookingId', b.id::text)
        );
        results := jsonb_set(results, '{resends}', (results->'resends') || to_jsonb('customer_sms'));
      END IF;
    END IF;

    -- Worker side (only if a worker is assigned)
    IF b.worker_id IS NOT NULL AND NOT (worker_email_sent OR worker_sms_sent) THEN
      PERFORM net.http_post(
        url := 'https://ggvplltpwsnvtcbpazbe.supabase.co/functions/v1/send-worker-assignment-notification',
        headers := jsonb_build_object(
          'Content-Type','application/json',
          'Authorization','Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdndnBsbHRwd3NudnRjYnBhemJlIiwicm9zZSI6ImFub24iLCJpYXQiOjE3NDk1MTU5NjIsImV4cCI6MjA2NTA5MTk2Mn0.cbZ4kBKP7odpP9r1Qrg4G6CA8XdW7vLdKsqr6gE0j_Q'
        ),
        body := jsonb_build_object('bookingId', b.id::text, 'workerId', b.worker_id::text)
      );
      results := jsonb_set(results, '{resends}', (results->'resends') || to_jsonb('worker_email'));

      IF public.is_sms_enabled() AND worker_phone IS NOT NULL THEN
        PERFORM net.http_post(
          url := 'https://ggvplltpwsnvtcbpazbe.supabase.co/functions/v1/send-sms-notification',
          headers := jsonb_build_object(
            'Content-Type','application/json',
            'Authorization','Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdndnBsbHRwd3NudnRjYnBhemJlIiwicm9zZSI6ImFub24iLCJpYXQiOjE3NDk1MTU5NjIsImV4cCI6MjA2NTA5MTk2Mn0.cbZ4kBKP7odpP9r1Qrg4G6CA8XdW7vLdKsqr6gE0j_Q'
          ),
          body := jsonb_build_object('bookingId', b.id::text)
        );
        results := jsonb_set(results, '{resends}', (results->'resends') || to_jsonb('worker_sms'));
      END IF;
    END IF;

    -- Log a summary if we resent anything
    IF jsonb_array_length(results->'resends') > 0 THEN
      INSERT INTO public.sms_logs (booking_id, recipient_number, message, status, error_message)
      VALUES (
        b.id,
        'system',
        'Per-booking watchdog resends: ' || array_to_string(ARRAY(SELECT jsonb_array_elements_text(results->'resends')), ', '),
        'sent',
        NULL
      );
    END IF;

  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.sms_logs (booking_id, recipient_number, message, status, error_message)
    VALUES (b.id, 'system', 'Per-booking watchdog failed', 'failed', SQLERRM);

    results := jsonb_set(results, '{errors}', (results->'errors') || to_jsonb(SQLERRM));
  END;

  RETURN results;
END;
$function$;

-- Allow authenticated users to execute (authorization is handled inside the function)
GRANT EXECUTE ON FUNCTION public.retry_unsent_notifications_for_booking(uuid) TO authenticated;
