-- 1) Create notification_settings table with RLS and helper
CREATE TABLE IF NOT EXISTS public.notification_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sms_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'notification_settings' AND policyname = 'Admins can manage notification settings'
  ) THEN
    CREATE POLICY "Admins can manage notification settings"
    ON public.notification_settings
    FOR ALL
    USING (EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin'::user_role))
    WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin'::user_role));
  END IF;
END $$;

-- updated_at trigger using existing helper
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_notification_settings_updated_at'
  ) THEN
    CREATE TRIGGER update_notification_settings_updated_at
    BEFORE UPDATE ON public.notification_settings
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- Seed a default row if empty (keeps SMS disabled by default)
INSERT INTO public.notification_settings (sms_enabled)
SELECT false
WHERE NOT EXISTS (SELECT 1 FROM public.notification_settings);

-- Helper function to read the toggle
CREATE OR REPLACE FUNCTION public.is_sms_enabled()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT sms_enabled FROM public.notification_settings ORDER BY updated_at DESC LIMIT 1),
    false
  );
$$;

-- 2) Update functions to respect the toggle
-- notify_worker_assignment: gate the worker SMS
CREATE OR REPLACE FUNCTION public.notify_worker_assignment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Only trigger when worker_id changes from NULL to a value (new assignment)
  IF OLD.worker_id IS NULL AND NEW.worker_id IS NOT NULL THEN
    -- Update booking status to confirmed when worker is assigned
    UPDATE public.bookings 
    SET status = 'confirmed'
    WHERE id = NEW.id;
    
    -- Call worker assignment email notification function (always allowed)
    PERFORM net.http_post(
      url := 'https://ggvplltpwsnvtcbpazbe.supabase.co/functions/v1/send-worker-assignment-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdndnBsbHRwd3NudnRjYnBhemJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk1MTU5NjIsImV4cCI6MjA2NTA5MTk2Mn0.cbZ4kBKP7odpP9r1Qrg4G6CA8XdW7vLdKsqr6gE0j_Q'
      ),
      body := jsonb_build_object(
        'bookingId', NEW.id::text,
        'workerId', NEW.worker_id::text
      )
    );
    
    -- Worker SMS (gated)
    IF public.is_sms_enabled() THEN
      PERFORM net.http_post(
        url := 'https://ggvplltpwsnvtcbpazbe.supabase.co/functions/v1/send-sms-notification',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdndnBsbHRwd3NudnRjYnBhemJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk1MTU5NjIsImV4cCI6MjA2NTA5MTk2Mn0.cbZ4kBKP7odpP9r1Qrg4G6CA8XdW7vLdKsqr6gE0j_Q'
        ),
        body := jsonb_build_object('bookingId', NEW.id::text)
      );
    ELSE
      INSERT INTO public.sms_logs (booking_id, recipient_number, message, status, error_message)
      VALUES (NEW.id, 'system', 'SMS disabled: worker SMS skipped', 'pending', NULL);
    END IF;
    
    -- Log the assignment for debugging
    INSERT INTO public.sms_logs (booking_id, recipient_number, message, status, error_message)
    VALUES (NEW.id, 'system', 'Worker assigned via trigger - notifications processed', 'sent', NULL);
  END IF;
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log any errors but don't fail the booking update
  INSERT INTO public.sms_logs (booking_id, recipient_number, message, status, error_message)
  VALUES (NEW.id, 'system', 'Worker assignment notification failed', 'failed', SQLERRM);
  RETURN NEW;
END;
$function$;

-- trigger_booking_notifications: gate both worker & customer SMS
CREATE OR REPLACE FUNCTION public.trigger_booking_notifications()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Fire only when a worker gets assigned (NULL -> NOT NULL)
  IF (TG_OP = 'INSERT' AND NEW.worker_id IS NOT NULL) OR
     (TG_OP = 'UPDATE' AND (OLD.worker_id IS NULL AND NEW.worker_id IS NOT NULL)) THEN

    -- Ensure booking is confirmed
    IF NEW.status != 'confirmed' THEN
      UPDATE public.bookings 
      SET status = 'confirmed'
      WHERE id = NEW.id;
    END IF;

    -- Worker assignment email
    PERFORM net.http_post(
      url := 'https://ggvplltpwsnvtcbpazbe.supabase.co/functions/v1/send-worker-assignment-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdndnBsbHRwd3NudnRjYnBhemJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk1MTU5NjIsImV4cCI6MjA2NTA5MTk2Mn0.cbZ4kBKP7odpP9r1Qrg4G6CA8XdW7vLdKsqr6gE0j_Q'
      ),
      body := jsonb_build_object(
        'bookingId', NEW.id::text,
        'workerId', NEW.worker_id::text
      )
    );

    -- Worker SMS (gated)
    IF public.is_sms_enabled() THEN
      PERFORM net.http_post(
        url := 'https://ggvplltpwsnvtcbpazbe.supabase.co/functions/v1/send-sms-notification',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdndnBsbHRwd3NudnRjYnBhemJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk1MTU5NjIsImV4cCI6MjA2NTA5MTk2Mn0.cbZ4kBKP7odpP9r1Qrg4G6CA8XdW7vLdKsqr6gE0j_Q'
        ),
        body := jsonb_build_object('bookingId', NEW.id::text)
      );
    ELSE
      INSERT INTO public.sms_logs (booking_id, recipient_number, message, status, error_message)
      VALUES (NEW.id, 'system', 'SMS disabled: worker SMS skipped', 'pending', NULL);
    END IF;

    -- Customer email (always allowed)
    PERFORM net.http_post(
      url := 'https://ggvplltpwsnvtcbpazbe.supabase.co/functions/v1/send-customer-booking-confirmation',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdndnBsbHRwd3NudnRjYnBhemJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk1MTU5NjIsImV4cCI6MjA2NTA5MTk2Mn0.cbZ4kBKP7odpP9r1Qrg4G6CA8XdW7vLdKsqr6gE0j_Q'
      ),
      body := jsonb_build_object('bookingId', NEW.id::text)
    );

    -- Customer SMS with worker details (gated)
    IF public.is_sms_enabled() THEN
      PERFORM net.http_post(
        url := 'https://ggvplltpwsnvtcbpazbe.supabase.co/functions/v1/send-customer-worker-sms',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdndnBsbHRwd3NudnRjYnBhemJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk1MTU5NjIsImV4cCI6MjA2NTA5MTk2Mn0.cbZ4kBKP7odpP9r1Qrg4G6CA8XdW7vLdKsqr6gE0j_Q'
        ),
        body := jsonb_build_object('bookingId', NEW.id::text)
      );
    ELSE
      INSERT INTO public.sms_logs (booking_id, recipient_number, message, status, error_message)
      VALUES (NEW.id, 'system', 'SMS disabled: customer SMS skipped', 'pending', NULL);
    END IF;

    -- Log consolidated notification
    INSERT INTO public.sms_logs (booking_id, recipient_number, message, status, error_message)
    VALUES (NEW.id, 'system', 'Booking notifications processed (emails active, SMS gated)', 'sent', NULL);
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  INSERT INTO public.sms_logs (booking_id, recipient_number, message, status, error_message)
  VALUES (NEW.id, 'system', 'Notification trigger failed', 'failed', SQLERRM);
  RETURN NEW;
END;
$function$;

-- resend_worker_sms: respect toggle
CREATE OR REPLACE FUNCTION public.resend_worker_sms(booking_id_param uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF public.is_sms_enabled() THEN
    -- Call the send-sms-notification edge function using net.http_post
    PERFORM net.http_post(
      url := 'https://ggvplltpwsnvtcbpazbe.supabase.co/functions/v1/send-sms-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdndnBsbHRwd3NudnRjYnBhemJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk1MTU5NjIsImV4cCI6MjA2NTA5MTk2Mn0.cbZ4kBKP7odpP9r1Qrg4G6CA8XdW7vLdKsqr6gE0j_Q'
      ),
      body := jsonb_build_object('bookingId', booking_id_param::text)
    );
    
    -- Log the manual SMS trigger
    INSERT INTO sms_logs (booking_id, recipient_number, message, status, error_message)
    VALUES (booking_id_param, 'manual', 'Manual SMS resend triggered', 'sent', NULL);
    
    RETURN TRUE;
  ELSE
    -- Log that SMS is disabled
    INSERT INTO sms_logs (booking_id, recipient_number, message, status, error_message)
    VALUES (booking_id_param, 'manual', 'Manual SMS resend skipped - SMS disabled', 'pending', NULL);
    RETURN FALSE;
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- Log error
  INSERT INTO sms_logs (booking_id, recipient_number, message, status, error_message)
  VALUES (booking_id_param, 'manual', 'Manual SMS resend failed', 'failed', SQLERRM);
  RETURN FALSE;
END;
$function$;

-- retry_unsent_notifications: gate SMS resends
CREATE OR REPLACE FUNCTION public.retry_unsent_notifications(p_lookback_minutes integer DEFAULT 30, p_grace_minutes integer DEFAULT 5)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  b record;
  results jsonb := '{"checked":0,"resends":0,"errors":0,"details":[]}'::jsonb;
  any_email_sent boolean;
  any_sms_sent boolean;
  message_text text;
  http_resp jsonb;
begin
  for b in
    select *
    from public.bookings
    where created_at between now() - make_interval(mins => p_lookback_minutes)
                         and     now() - make_interval(mins => p_grace_minutes)
      and status = 'confirmed'
      and (payment_status in ('authorized','completed','captured'))
  loop
    results := jsonb_set(results, '{checked}', ((results->>'checked')::int + 1)::text::jsonb);

    -- Consider it OK if either an email or a real SMS (not system/manual/admin) was sent
    select exists (
      select 1 from public.email_logs el
      where el.booking_id = b.id
        and el.status = 'sent'
        and coalesce(el.sent_at, el.created_at) > b.created_at
    ) into any_email_sent;

    select exists (
      select 1 from public.sms_logs sl
      where sl.booking_id = b.id
        and sl.status = 'sent'
        and sl.recipient_number not in ('system','manual','admin')
        and coalesce(sl.sent_at, sl.created_at) > b.created_at
    ) into any_sms_sent;

    if any_email_sent or any_sms_sent then
      continue; -- At least one channel succeeded; no action needed
    end if;

    begin
      -- Resend customer confirmation email (always allowed)
      perform net.http_post(
        url := 'https://ggvplltpwsnvtcbpazbe.supabase.co/functions/v1/send-customer-booking-confirmation',
        headers := jsonb_build_object(
          'Content-Type','application/json',
          'Authorization','Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdndnBsbHRwd3NudnRjYnBhemJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk1MTU5NjIsImV4cCI6MjA2NTA5MTk2Mn0.cbZ4kBKP7odpP9r1Qrg4G6CA8XdW7vLdKsqr6gE0j_Q'
        ),
        body := jsonb_build_object('bookingId', b.id::text)
      );

      message_text := 'Watchdog: re-sent customer confirmation email';

      -- If a worker is assigned, also resend worker notifications and optionally SMS to both (gated)
      if b.worker_id is not null then
        -- Worker assignment email
        perform net.http_post(
          url := 'https://ggvplltpwsnvtcbpazbe.supabase.co/functions/v1/send-worker-assignment-notification',
          headers := jsonb_build_object(
            'Content-Type','application/json',
            'Authorization','Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdndnBsbHRwd3NudnRjYnBhemJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk1MTU5NjIsImV4cCI6MjA2NTA5MTk2Mn0.cbZ4kBKP7odpP9r1Qrg4G6CA8XdW7vLdKsqr6gE0j_Q'
          ),
          body := jsonb_build_object('bookingId', b.id::text, 'workerId', b.worker_id::text)
        );

        if public.is_sms_enabled() then
          -- Worker SMS
          perform net.http_post(
            url := 'https://ggvplltpwsnvtcbpazbe.supabase.co/functions/v1/send-sms-notification',
            headers := jsonb_build_object(
              'Content-Type','application/json',
              'Authorization','Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdndnBsbHRwd3NudnRjYnBhemJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk1MTU5NjIsImV4cCI6MjA2NTA5MTk2Mn0.cbZ4kBKP7odpP9r1Qrg4G6CA8XdW7vLdKsqr6gE0j_Q'
            ),
            body := jsonb_build_object('bookingId', b.id::text)
          );

          -- Customer SMS with worker details
          perform net.http_post(
            url := 'https://ggvplltpwsnvtcbpazbe.supabase.co/functions/v1/send-customer-worker-sms',
            headers := jsonb_build_object(
              'Content-Type','application/json',
              'Authorization','Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdndnBsbHRwd3NudnRjYnBhemJlIiwicm9zZSI6ImFub24iLCJpYXQiOjE3NDk1MTU5NjIsImV4cCI6MjA2NTA5MTk2Mn0.cbZ4kBKP7odpP9r1Qrg4G6CA8XdW7vLdKsqr6gE0j_Q'
            ),
            body := jsonb_build_object('bookingId', b.id::text)
          );

          message_text := message_text || '; worker email + SMS and customer SMS re-sent';
        else
          message_text := message_text || '; worker email re-sent (SMS disabled)';
        end if;
      else
        message_text := message_text || '; no worker assigned yet';
      end if;

      insert into public.sms_logs (booking_id, recipient_number, message, status, error_message)
      values (b.id, 'system', message_text, 'sent', null);

      results := jsonb_set(results, '{resends}', ((results->>'resends')::int + 1)::text::jsonb);
      results := jsonb_set(
        results,
        '{details}',
        (results->'details') || jsonb_build_object('booking_id', b.id, 'action', message_text)
      );

    exception when others then
      insert into public.sms_logs (booking_id, recipient_number, message, status, error_message)
      values (b.id, 'system', 'Watchdog: resend failed', 'failed', SQLERRM);
      results := jsonb_set(results, '{errors}', ((results->>'errors')::int + 1)::text::jsonb);
      results := jsonb_set(
        results,
        '{details}',
        (results->'details') || jsonb_build_object('booking_id', b.id, 'error', SQLERRM)
      );
    end;
  end loop;

  return results;
end;
$function$;