-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Enable pg_net extension for HTTP requests if not already enabled  
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create a scheduled job to run email follow-ups every hour
-- This will check for bookings that need payment reminder emails
SELECT cron.schedule(
  'email-followup-check',
  '0 * * * *', -- Every hour at minute 0
  $$
  SELECT
    net.http_post(
      url := 'https://ggvplltpwsnvtcbpazbe.supabase.co/functions/v1/email-notification-orchestrator',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdndnBsbHRwd3NudnRjYnBhemJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk1MTU5NjIsImV4cCI6MjA2NTA5MTk2Mn0.cbZ4kBKP7odpP9r1Qrg4G6CA8XdW7vLdKsqr6gE0j_Q"}'::jsonb,
      body := '{"trigger": "scheduled_check"}'::jsonb
    ) as request_id;
  $$
);

-- Create a function to manually trigger email follow-ups (for testing/admin use)
CREATE OR REPLACE FUNCTION public.trigger_email_followups()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  result jsonb;
BEGIN
  -- Call the email orchestrator function
  SELECT net.http_post(
    url := 'https://ggvplltpwsnvtcbpazbe.supabase.co/functions/v1/email-notification-orchestrator',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdndnBsbHRwd3NudnRjYnBhemJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk1MTU5NjIsImV4cCI6MjA2NTA5MTk2Mn0.cbZ4kBKP7odpP9r1Qrg4G6CA8XdW7vLdKsqr6gE0j_Q'
    ),
    body := jsonb_build_object('trigger', 'scheduled_check')
  ) INTO result;
  
  -- Log the manual trigger
  INSERT INTO public.sms_logs (booking_id, recipient_number, message, status, error_message)
  VALUES (NULL, 'system', 'Manual email followup check triggered', 'sent', NULL);
  
  RETURN jsonb_build_object('success', true, 'result', result);
EXCEPTION WHEN OTHERS THEN
  -- Log error and return it
  INSERT INTO public.sms_logs (booking_id, recipient_number, message, status, error_message)
  VALUES (NULL, 'system', 'Manual email followup trigger failed', 'failed', SQLERRM);
  
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$function$;