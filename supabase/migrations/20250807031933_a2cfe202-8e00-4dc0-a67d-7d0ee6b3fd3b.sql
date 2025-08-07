-- Create manual assignment function for urgent bookings
CREATE OR REPLACE FUNCTION public.trigger_manual_worker_assignment(p_booking_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  -- Call the assign-authorized-booking-worker edge function
  PERFORM pg_net.http_post(
    url := 'https://ggvplltpwsnvtcbpazbe.supabase.co/functions/v1/assign-authorized-booking-worker',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdndnBsbHRwd3NudnRjYnBhemJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk1MTU5NjIsImV4cCI6MjA2NTA5MTk2Mn0.cbZ4kBKP7odpP9r1Qrg4G6CA8XdW7vLdKsqr6gE0j_Q'
    ),
    body := jsonb_build_object('booking_id', p_booking_id)
  );
  
  -- Log the manual assignment trigger
  INSERT INTO sms_logs (booking_id, recipient_number, message, status, error_message)
  VALUES (p_booking_id, 'system', 'Manual worker assignment triggered', 'sent', NULL);
  
  RETURN TRUE;
EXCEPTION WHEN OTHERS THEN
  -- Log error
  INSERT INTO sms_logs (booking_id, recipient_number, message, status, error_message)
  VALUES (p_booking_id, 'system', 'Manual assignment trigger failed', 'failed', SQLERRM);
  RETURN FALSE;
END;
$function$;