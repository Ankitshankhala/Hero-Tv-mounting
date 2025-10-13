-- Create trigger function for automatic worker assignment on payment authorization
CREATE OR REPLACE FUNCTION trigger_worker_assignment_on_payment_auth()
RETURNS TRIGGER AS $$
BEGIN
  -- Only trigger when payment becomes authorized and no worker is assigned yet
  IF NEW.payment_status = 'authorized' AND 
     (OLD.payment_status IS NULL OR OLD.payment_status != 'authorized') AND
     NEW.worker_id IS NULL THEN
    
    -- Log the trigger activation
    INSERT INTO sms_logs (booking_id, recipient_number, message, status, error_message)
    VALUES (NEW.id, 'system', 'Auto-assignment triggered on payment authorization', 'sent', NULL);
    
    -- Call worker assignment edge function asynchronously
    PERFORM net.http_post(
      url := 'https://ggvplltpwsnvtcbpazbe.supabase.co/functions/v1/assign-authorized-booking-worker',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdndnBsbHRwd3NudnRjYnBhemJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk1MTU5NjIsImV4cCI6MjA2NTA5MTk2Mn0.cbZ4kBKP7odpP9r1Qrg4G6CA8XdW7vLdKsqr6gE0j_Q'
      ),
      body := jsonb_build_object('booking_id', NEW.id)
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS auto_assign_worker_on_payment_auth ON bookings;

-- Create trigger on bookings table
CREATE TRIGGER auto_assign_worker_on_payment_auth
  AFTER UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION trigger_worker_assignment_on_payment_auth();

-- Manual recovery function for stuck bookings (admins can call this)
CREATE OR REPLACE FUNCTION recover_stuck_payment_authorized_bookings()
RETURNS TABLE(booking_id uuid, assignment_triggered boolean) AS $$
DECLARE
  stuck_booking RECORD;
BEGIN
  -- Find all bookings stuck in payment_authorized without a worker
  FOR stuck_booking IN 
    SELECT id FROM bookings 
    WHERE payment_status = 'authorized' 
    AND worker_id IS NULL
    AND status IN ('payment_pending', 'pending')
  LOOP
    -- Trigger assignment for each stuck booking
    PERFORM net.http_post(
      url := 'https://ggvplltpwsnvtcbpazbe.supabase.co/functions/v1/assign-authorized-booking-worker',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdndnBsbHRwd3NudnRjYnBhemJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk1MTU5NjIsImV4cCI6MjA2NTA5MTk2Mn0.cbZ4kBKP7odpP9r1Qrg4G6CA8XdW7vLdKsqr6gE0j_Q'
      ),
      body := jsonb_build_object('booking_id', stuck_booking.id)
    );
    
    -- Log recovery action
    INSERT INTO sms_logs (booking_id, recipient_number, message, status, error_message)
    VALUES (stuck_booking.id, 'system', 'Manual recovery: worker assignment triggered', 'sent', NULL);
    
    RETURN QUERY SELECT stuck_booking.id, true;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;