-- Add confirmation_email_sent flag to bookings table
ALTER TABLE public.bookings 
ADD COLUMN confirmation_email_sent BOOLEAN DEFAULT FALSE;

-- Update the booking notification trigger to handle the new requirements
CREATE OR REPLACE FUNCTION public.trigger_booking_notifications()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  should_send_payment_pending BOOLEAN := false;
  should_send_confirmation BOOLEAN := false;
BEGIN
  -- For INSERT operations (new bookings)
  IF TG_OP = 'INSERT' THEN
    -- Always send payment pending email for new bookings
    should_send_payment_pending := true;
  END IF;
  
  -- For UPDATE operations
  IF TG_OP = 'UPDATE' THEN
    -- Send confirmation email when:
    -- 1. Payment status becomes 'authorized' or 'completed'
    -- 2. Worker is assigned (worker_id is not null)
    -- 3. Confirmation email hasn't been sent yet
    IF (NEW.payment_status IN ('authorized', 'completed', 'captured') AND 
        OLD.payment_status NOT IN ('authorized', 'completed', 'captured')) OR
       (NEW.worker_id IS NOT NULL AND OLD.worker_id IS NULL) THEN
      
      -- Only send if both payment is confirmed and worker is assigned and email not sent
      IF NEW.payment_status IN ('authorized', 'completed', 'captured') AND 
         NEW.worker_id IS NOT NULL AND 
         NEW.confirmation_email_sent = FALSE THEN
        should_send_confirmation := true;
        
        -- Mark confirmation email as sent to prevent duplicates
        NEW.confirmation_email_sent := true;
      END IF;
    END IF;
  END IF;
  
  -- Send payment pending notification for new bookings
  IF should_send_payment_pending THEN
    PERFORM net.http_post(
      url := 'https://ggvplltpwsnvtcbpazbe.supabase.co/functions/v1/send-payment-pending-notice',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdndnBsbHRwd3NudnRjYnBhemJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk1MTU5NjIsImV4cCI6MjA2NTA5MTk2Mn0.cbZ4kBKP7odpP9r1Qrg4G6CA8XdW7vLdKsqr6gE0j_Q'
      ),
      body := jsonb_build_object(
        'bookingId', NEW.id,
        'trigger', 'payment_pending'
      )
    );
    
    -- Log the trigger attempt
    INSERT INTO sms_logs (booking_id, recipient_number, message, status, error_message)
    VALUES (NEW.id, 'system', 'Payment pending email triggered', 'sent', NULL);
  END IF;
  
  -- Send confirmation notification when ready
  IF should_send_confirmation THEN
    PERFORM net.http_post(
      url := 'https://ggvplltpwsnvtcbpazbe.supabase.co/functions/v1/send-customer-booking-confirmation',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdndnBsbHRwd3NudnRjYnBhemJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk1MTU5NjIsImV4cCI6MjA2NTA5MTk2Mn0.cbZ4kBKP7odbmm1Qrg4G6CA8XdW7vLdKsqr6gE0j_Q'
      ),
      body := jsonb_build_object(
        'bookingId', NEW.id,
        'trigger', 'booking_confirmed'
      )
    );
    
    -- Log the trigger attempt
    INSERT INTO sms_logs (booking_id, recipient_number, message, status, error_message)
    VALUES (NEW.id, 'system', 'Confirmation email triggered', 'sent', NULL);
  END IF;
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log error but don't fail the main operation
  INSERT INTO sms_logs (booking_id, recipient_number, message, status, error_message)
  VALUES (NEW.id, 'system', 'Notification trigger failed', 'failed', SQLERRM);
  RETURN NEW;
END;
$$;

-- Drop the old trigger and create the new one
DROP TRIGGER IF EXISTS booking_notifications_trigger ON public.bookings;
CREATE TRIGGER booking_notifications_trigger
  AFTER INSERT OR UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_booking_notifications();

-- Drop the old payment pending trigger since it's now handled by the main trigger
DROP TRIGGER IF EXISTS booking_payment_pending_trigger ON public.bookings;
DROP FUNCTION IF EXISTS public.send_payment_pending_notification();

-- Drop the old email trigger since it's now handled by the main trigger  
DROP TRIGGER IF EXISTS booking_email_notifications_trigger ON public.bookings;
DROP FUNCTION IF EXISTS public.trigger_email_notifications();