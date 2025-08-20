-- Update the cron job to run every 2 minutes instead of every hour
-- First, unschedule the existing job
SELECT cron.unschedule('email-followup-check');

-- Create a new scheduled job to run every 2 minutes
SELECT cron.schedule(
  'email-followup-check-frequent',
  '*/2 * * * *', -- Every 2 minutes
  $$
  SELECT
    net.http_post(
      url := 'https://ggvplltpwsnvtcbpazbe.supabase.co/functions/v1/email-notification-orchestrator',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdndnBsbHRwd3NudnRjYnBhemJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk1MTU5NjIsImV4cCI6MjA2NTA5MTk2Mn0.cbZ4kBKP7odpP9r1Qrg4G6CA8XdW7vLdKsqr6gE0j_Q"}'::jsonb,
      body := '{"trigger": "scheduled_check"}'::jsonb
    ) as request_id;
  $$
);