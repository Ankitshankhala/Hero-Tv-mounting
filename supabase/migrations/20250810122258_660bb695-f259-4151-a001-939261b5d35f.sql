-- Ensure required extensions
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Remove any existing retry jobs to avoid duplicates
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT jobid FROM cron.job WHERE command ILIKE '%retry_unsent_notifications%'
  LOOP
    PERFORM cron.unschedule(r.jobid);
  END LOOP;
END $$;

-- Schedule the safety sweep every 5 minutes with a 120-minute lookback and 5-minute grace
select cron.schedule(
  'retry-missing-notifications-every-5m',
  '*/5 * * * *',
  $$ select public.retry_unsent_notifications(120, 5); $$
);
