-- Create function to trigger email notifications on booking status changes
CREATE OR REPLACE FUNCTION trigger_email_notifications()
RETURNS TRIGGER AS $$
DECLARE
  should_send_email BOOLEAN := false;
  email_trigger_reason TEXT := '';
BEGIN
  -- Only trigger emails for relevant status changes
  IF TG_OP = 'UPDATE' THEN
    -- Stage 1: Payment authorized AND worker assigned (confirmation email)
    IF NEW.payment_status = 'authorized' AND NEW.worker_id IS NOT NULL AND 
       (OLD.payment_status != 'authorized' OR OLD.worker_id IS NULL) THEN
      should_send_email := true;
      email_trigger_reason := 'booking_confirmed';
    END IF;
    
    -- Stage 2: Booking created but payment pending (reminder email)
    -- Send reminder 2 hours after booking creation if payment still pending
    IF NEW.payment_status = 'pending' AND 
       NEW.created_at < NOW() - INTERVAL '2 hours' AND
       OLD.created_at >= NOW() - INTERVAL '2 hours' THEN
      should_send_email := true;
      email_trigger_reason := 'payment_reminder';
    END IF;
  END IF;
  
  -- Insert into NEW row first
  IF TG_OP = 'INSERT' THEN
    -- Don't send emails immediately on insert, wait for payment processing
    NULL;
  END IF;
  
  -- Trigger email notification asynchronously if needed
  IF should_send_email THEN
    -- Call the email orchestrator function
    PERFORM net.http_post(
      url := 'https://ggvplltpwsnvtcbpazbe.supabase.co/functions/v1/email-notification-orchestrator',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdndnBsbHRwd3NudnRjYnBhemJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk1MTU5NjIsImV4cCI6MjA2NTA5MTk2Mn0.cbZ4kBKP7odpP9r1Qrg4G6CA8XdW7vLdKsqr6gE0j_Q'
      ),
      body := jsonb_build_object(
        'bookingId', NEW.id,
        'trigger', email_trigger_reason
      )
    );
    
    -- Log the trigger attempt
    INSERT INTO sms_logs (booking_id, recipient_number, message, status, error_message)
    VALUES (NEW.id, 'system', 'Email notification triggered: ' || email_trigger_reason, 'sent', NULL);
  END IF;
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log error but don't fail the main operation
  INSERT INTO sms_logs (booking_id, recipient_number, message, status, error_message)
  VALUES (NEW.id, 'system', 'Email trigger failed', 'failed', SQLERRM);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on bookings table
DROP TRIGGER IF EXISTS bookings_email_notification_trigger ON bookings;
CREATE TRIGGER bookings_email_notification_trigger
  AFTER UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION trigger_email_notifications();

-- Create a function to manually send email notifications for existing bookings
CREATE OR REPLACE FUNCTION send_email_for_booking(p_booking_id UUID)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  -- Call the email orchestrator function directly
  SELECT net.http_post(
    url := 'https://ggvplltpwsnvtcbpazbe.supabase.co/functions/v1/email-notification-orchestrator',
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
$$ LANGUAGE plpgsql SECURITY DEFINER;