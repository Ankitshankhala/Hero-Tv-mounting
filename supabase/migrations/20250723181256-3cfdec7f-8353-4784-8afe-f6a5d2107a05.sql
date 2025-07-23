-- Enable pg_cron and pg_net extensions for scheduled tasks
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create a scheduled cleanup job that runs every 30 minutes
SELECT cron.schedule(
  'cleanup-abandoned-bookings',
  '*/30 * * * *', -- Every 30 minutes
  $$
  SELECT
    net.http_post(
        url:='https://ggvplltpwsnvtcbpazbe.supabase.co/functions/v1/cleanup-unpaid-bookings',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdndnBsbHRwd3NudnRjYnBhemJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk1MTU5NjIsImV4cCI6MjA2NTA5MTk2Mn0.cbZ4kBKP7odpP9r1Qrg4G6CA8XdW7vLdKsqr6gE0j_Q"}'::jsonb,
        body:=concat('{"scheduled_run": "', now(), '"}')::jsonb
    ) as request_id;
  $$
);

-- Create a scheduled cleanup job for database maintenance that runs daily at 2 AM
SELECT cron.schedule(
  'cleanup-database-maintenance', 
  '0 2 * * *', -- Daily at 2 AM
  $$
  SELECT public.cleanup_expired_idempotency_records();
  SELECT public.cleanup_orphaned_payment_records();
  $$
);

-- View scheduled jobs
SELECT * FROM cron.job;