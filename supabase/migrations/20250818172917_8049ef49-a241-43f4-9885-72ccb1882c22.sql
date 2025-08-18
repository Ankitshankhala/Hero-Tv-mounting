
-- 1) Enable required extensions (safe if already installed)
create extension if not exists pg_net;
create extension if not exists pg_cron;

-- 2) Function to run the watchdog in batch
create or replace function public.run_automated_watchdog(
  p_lookback_minutes integer default 120,
  p_batch_limit integer default 100
) returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  b record;
  checked int := 0;
  invoked int := 0;
  errors int := 0;
  resp jsonb;
begin
  for b in
    select id
    from public.bookings
    where (created_at >= now() - make_interval(mins => p_lookback_minutes)
           or updated_at >= now() - make_interval(mins => p_lookback_minutes))
      and (
        status in ('payment_authorized','confirmed','completed')
        or payment_status in ('authorized','completed','captured')
      )
    order by greatest(created_at, updated_at) desc
    limit p_batch_limit
  loop
    checked := checked + 1;
    begin
      select net.http_post(
        url := 'https://ggvplltpwsnvtcbpazbe.supabase.co/functions/v1/booking-notification-watchdog',
        headers := jsonb_build_object(
          'Content-Type','application/json',
          'Authorization','Bearer ' ||
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdndnBsbHRwd3NudnRjYnBhemJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk1MTU5NjIsImV4cCI6MjA2NTA5MTk2Mn0.cbZ4kBKP7odpP9r1Qrg4G6CA8XdW7vLdKsqr6gE0j_Q'
        ),
        body := jsonb_build_object('bookingId', b.id)
      ) into resp;

      invoked := invoked + 1;

      -- Optional: progress log every 20 invocations
      if invoked % 20 = 0 then
        insert into public.sms_logs(booking_id, recipient_number, message, status)
        values (null, 'system', 'Watchdog batch progress: '||invoked||' invoked', 'sent');
      end if;

    exception when others then
      errors := errors + 1;
      insert into public.sms_logs(booking_id, recipient_number, message, status, error_message)
      values (b.id, 'system', 'Watchdog invoke failed', 'failed', sqlerrm);
    end;
  end loop;

  insert into public.sms_logs(booking_id, recipient_number, message, status)
  values (null, 'system', 'Watchdog batch: checked='||checked||', invoked='||invoked||', errors='||errors, 'sent');

  return jsonb_build_object('checked', checked, 'invoked', invoked, 'errors', errors);
end;
$function$;

-- 3) Schedule cron job every 5 minutes (idempotent: unschedule first if exists)
do $$
declare
  job_id int;
begin
  select j.jobid into job_id from cron.job j where j.jobname = 'run-watchdog-every-5-min';
  if job_id is not null then
    perform cron.unschedule(job_id);
  end if;

  perform cron.schedule(
    'run-watchdog-every-5-min',
    '*/5 * * * *',
    $sql$
      select public.run_automated_watchdog(120, 100);
    $sql$
  );
end$$;
