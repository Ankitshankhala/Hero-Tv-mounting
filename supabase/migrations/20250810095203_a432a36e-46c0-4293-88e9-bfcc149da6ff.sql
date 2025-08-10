-- Ensure required extensions
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema extensions;

-- Retry function to re-send notifications if none were sent within the grace period
create or replace function public.retry_unsent_notifications(
  p_lookback_minutes integer default 30,
  p_grace_minutes integer default 5
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
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
      -- Resend customer confirmation email
      perform net.http_post(
        url := 'https://ggvplltpwsnvtcbpazbe.supabase.co/functions/v1/send-customer-booking-confirmation',
        headers := jsonb_build_object(
          'Content-Type','application/json',
          'Authorization','Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdndnBsbHRwd3NudnRjYnBhemJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk1MTU5NjIsImV4cCI6MjA2NTA5MTk2Mn0.cbZ4kBKP7odpP9r1Qrg4G6CA8XdW7vLdKsqr6gE0j_Q'
        ),
        body := jsonb_build_object('bookingId', b.id::text)
      );

      message_text := 'Watchdog: re-sent customer confirmation email';

      -- If a worker is assigned, also resend worker notifications and SMS to both
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
            'Authorization','Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdndnBsbHRwd3NudnRjYnBhemJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk1MTU5NjIsImV4cCI6MjA2NTA5MTk2Mn0.cbZ4kBKP7odpP9r1Qrg4G6CA8XdW7vLdKsqr6gE0j_Q'
          ),
          body := jsonb_build_object('bookingId', b.id::text)
        );

        message_text := message_text || '; worker email + SMS and customer SMS re-sent';
      else
        -- No worker yet: at least send worker coverage might be handled elsewhere; here we only ensure customer email
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
$$;

-- Schedule the watchdog to run every 2 minutes
-- Try to unschedule existing job (if any), ignore errors
do $$
begin
  perform cron.unschedule('notification-watchdog');
exception when others then
  null;
end $$;

select cron.schedule(
  'notification-watchdog',
  '*/2 * * * *',
  $$ select public.retry_unsent_notifications(30, 5); $$
);
