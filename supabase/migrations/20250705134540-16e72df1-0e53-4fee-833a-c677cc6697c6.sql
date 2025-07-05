-- Update the trigger function to use pg_net extension
CREATE OR REPLACE FUNCTION notify_worker_assignment()
RETURNS TRIGGER AS $$
DECLARE
  service_role_key TEXT;
BEGIN
  -- Only trigger when worker_id changes from NULL to a value (new assignment)
  IF OLD.worker_id IS NULL AND NEW.worker_id IS NOT NULL THEN
    -- Get the service role key from Supabase secrets
    service_role_key := current_setting('app.settings.service_role_key', true);
    
    -- Fallback to a default approach if the setting is not available
    IF service_role_key IS NULL OR service_role_key = '' THEN
      -- Log the assignment for manual processing if automatic SMS fails
      INSERT INTO sms_logs (booking_id, recipient_number, message, status, error_message)
      VALUES (NEW.id, 'system', 'Worker assignment notification', 'failed', 'Service role key not available');
      RETURN NEW;
    END IF;
    
    -- Call the send-sms-notification edge function using pg_net
    PERFORM pg_net.http_post(
      url := 'https://ggvplltpwsnvtcbpazbe.supabase.co/functions/v1/send-sms-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_role_key
      ),
      body := jsonb_build_object('bookingId', NEW.id)
    );
  END IF;
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log any errors but don't fail the booking update
  INSERT INTO sms_logs (booking_id, recipient_number, message, status, error_message)
  VALUES (NEW.id, 'system', 'Worker assignment notification', 'failed', SQLERRM);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;