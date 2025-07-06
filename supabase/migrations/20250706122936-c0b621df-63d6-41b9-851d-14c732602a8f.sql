-- Update the trigger function to use the anon key directly  
CREATE OR REPLACE FUNCTION public.trigger_auto_invoice()
RETURNS TRIGGER AS $$
BEGIN
  -- Call the auto-invoice edge function via pg_net using anon key
  PERFORM pg_net.http_post(
    url := 'https://ggvplltpwsnvtcbpazbe.supabase.co/functions/v1/auto-invoice',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdndnBsbHRwd3NudnRjYnBhemJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk1MTU5NjIsImV4cCI6MjA2NTA5MTk2Mn0.cbZ4kBKP7odpP9r1Qrg4G6CA8XdW7vLdKsqr6gE0j_Q'
    ),
    body := jsonb_build_object(
      'type', TG_OP,
      'table', TG_TABLE_NAME,
      'record', row_to_json(NEW),
      'old_record', CASE WHEN TG_OP = 'UPDATE' THEN row_to_json(OLD) ELSE NULL END
    )
  );
  
  RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN OTHERS THEN
  -- Log error but don't fail the main operation
  INSERT INTO sms_logs (booking_id, recipient_number, message, status, error_message)
  VALUES (
    CASE WHEN TG_TABLE_NAME = 'bookings' THEN NEW.id ELSE NEW.booking_id END,
    'system',
    'Auto-invoice trigger failed',
    'failed',
    SQLERRM
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;