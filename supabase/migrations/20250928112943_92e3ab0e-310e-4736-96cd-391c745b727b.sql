-- Update database functions to use unified-email-dispatcher instead of email-notification-orchestrator

-- Update trigger_email_followups function
CREATE OR REPLACE FUNCTION public.trigger_email_followups()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  result jsonb;
BEGIN
  -- Call the unified email dispatcher function
  SELECT net.http_post(
    url := 'https://ggvplltpwsnvtcbpazbe.supabase.co/functions/v1/unified-email-dispatcher',
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

-- Update send_email_for_booking function  
CREATE OR REPLACE FUNCTION public.send_email_for_booking(p_booking_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  result JSONB;
BEGIN
  -- Call the unified email dispatcher function directly
  SELECT net.http_post(
    url := 'https://ggvplltpwsnvtcbpazbe.supabase.co/functions/v1/unified-email-dispatcher',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdndnBsbHRwd3NudnRjYnBhemJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk1MTU5NjIsImV4cCI6MjA2NTA5MTk2Mn0.cbZ4kBKP7odpP9r1Qrg4G6CA8XdW7vLdKsqr6gE0j_Q'
    ),
    body := jsonb_build_object(
      'bookingId', p_booking_id,
      'trigger', 'manual'
    )
  ) INTO result;
  
  -- Log the manual trigger
  INSERT INTO sms_logs (booking_id, recipient_number, message, status, error_message)
  VALUES (p_booking_id, 'system', 'Manual email notification triggered', 'sent', NULL);
  
  RETURN jsonb_build_object('success', true, 'result', result);
EXCEPTION WHEN OTHERS THEN
  -- Log error and return it
  INSERT INTO sms_logs (booking_id, recipient_number, message, status, error_message)
  VALUES (p_booking_id, 'system', 'Manual email trigger failed', 'failed', SQLERRM);
  
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$function$;

-- Update cron job to use unified-email-dispatcher
SELECT cron.unschedule('email-followup-check-frequent');

SELECT cron.schedule(
  'email-followup-check-unified',
  '*/2 * * * *', -- Every 2 minutes
  $$
  SELECT
    net.http_post(
      url := 'https://ggvplltpwsnvtcbpazbe.supabase.co/functions/v1/unified-email-dispatcher',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdndnBsbHRwd3NudnRjYnBhemJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk1MTU5NjIsImV4cCI6MjA2NTA5MTk2Mn0.cbZ4kBKP7odpP9r1Qrg4G6CA8XdW7vLdKsqr6gE0j_Q"}'::jsonb,
      body := '{"trigger": "scheduled_check"}'::jsonb
    ) as request_id;
  $$
);