-- Fix idempotency and email deduplication issues
-- Add unique indexes to prevent race conditions and improve deduplication

-- 1. Add unique index to email_logs for better deduplication
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_logs_unique_booking_type_recipient 
ON public.email_logs (booking_id, email_type, recipient_email, status)
WHERE status = 'sent';

-- 2. Add unique index to idempotency_records to prevent race conditions
CREATE UNIQUE INDEX IF NOT EXISTS idx_idempotency_unique_key_operation_user 
ON public.idempotency_records (idempotency_key, operation_type, user_id)
WHERE status IN ('pending', 'completed');

-- 3. Add a function to check if SMS is enabled globally
CREATE OR REPLACE FUNCTION public.is_sms_enabled()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Check if SMS is enabled in notification settings
  RETURN EXISTS (
    SELECT 1 FROM public.notification_settings 
    WHERE sms_enabled = true 
    LIMIT 1
  );
END;
$function$;

-- 4. Drop and recreate the watchdog function with proper return type
DROP FUNCTION IF EXISTS public.run_automated_watchdog();

CREATE OR REPLACE FUNCTION public.run_automated_watchdog()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  booking_record RECORD;
  processed_count INTEGER := 0;
  results jsonb := '{"processed": 0, "actions": []}'::jsonb;
BEGIN
  -- Process bookings from the last 2 hours that might need email notifications
  FOR booking_record IN
    SELECT b.id, b.created_at, b.payment_status, b.status, b.worker_id, b.customer_id, b.guest_customer_info
    FROM public.bookings b
    WHERE b.created_at >= NOW() - INTERVAL '2 hours'
    AND b.status IN ('confirmed', 'payment_authorized', 'pending')
    AND (b.payment_status IN ('authorized', 'completed', 'captured', 'pending'))
  LOOP
    -- Call the watchdog function for each booking
    PERFORM net.http_post(
      url := 'https://ggvplltpwsnvtcbpazbe.supabase.co/functions/v1/booking-notification-watchdog',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdndnBsbHRwd3NudnRjYnBhemJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk1MTU5NjIsImV4cCI6MjA2NTA5MTk2Mn0.cbZ4kBKP7odpP9r1Qrg4G6CA8XdW7vLdKsqr6gE0j_Q'
      ),
      body := jsonb_build_object('bookingId', booking_record.id)
    );
    
    processed_count := processed_count + 1;
  END LOOP;
  
  -- Update results
  results := jsonb_set(results, '{processed}', processed_count::text::jsonb);
  
  -- Log the automated run
  INSERT INTO public.sms_logs (booking_id, recipient_number, message, status, error_message)
  VALUES (NULL, 'system', 'Automated watchdog processed ' || processed_count || ' bookings', 'sent', NULL);
  
  RETURN results;
END;
$function$;

-- 5. Create a trigger to only send necessary notifications without loops
CREATE OR REPLACE FUNCTION public.trigger_selective_email_notifications()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  -- Only trigger on specific meaningful state changes
  IF TG_OP = 'UPDATE' THEN
    -- Worker assignment notification (one-time only)
    IF NEW.worker_id IS NOT NULL AND OLD.worker_id IS NULL THEN
      -- Call watchdog function to handle worker assignment email
      PERFORM net.http_post(
        url := 'https://ggvplltpwsnvtcbpazbe.supabase.co/functions/v1/booking-notification-watchdog',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdndnBsbHRwd3NudnRjYnBhemJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk1MTU5NjIsImV4cCI6MjA2NTA5MTk2Mn0.cbZ4kBKP7odpP9r1Qrg4G6CA8XdW7vLdKsqr6gE0j_Q'
        ),
        body := jsonb_build_object('bookingId', NEW.id)
      );
      
      -- Log the trigger
      INSERT INTO public.sms_logs (booking_id, recipient_number, message, status, error_message)
      VALUES (NEW.id, 'system', 'Worker assignment notification triggered', 'sent', NULL);
    END IF;
    
    -- Payment status change to authorized (one-time only)
    IF NEW.payment_status = 'authorized' AND OLD.payment_status != 'authorized' THEN
      -- Call watchdog function to handle payment authorization email
      PERFORM net.http_post(
        url := 'https://ggvplltpwsnvtcbpazbe.supabase.co/functions/v1/booking-notification-watchdog',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdndnBsbHRwd3NudnRjYnBhemJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk1MTU5NjIsImV4cCI6MjA2NTA5MTk2Mn0.cbZ4kBKP7odpP9r1Qrg4G6CA8XdW7vLdKsqr6gE0j_Q'
        ),
        body := jsonb_build_object('bookingId', NEW.id)
      );
      
      -- Log the trigger
      INSERT INTO public.sms_logs (booking_id, recipient_number, message, status, error_message)
      VALUES (NEW.id, 'system', 'Payment authorization notification triggered', 'sent', NULL);
    END IF;
  END IF;
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log error but don't fail the main operation
  INSERT INTO public.sms_logs (booking_id, recipient_number, message, status, error_message)
  VALUES (NEW.id, 'system', 'Selective email trigger failed', 'failed', SQLERRM);
  RETURN NEW;
END;
$function$;

-- 6. Re-enable only the essential selective trigger
DROP TRIGGER IF EXISTS selective_email_notifications_trigger ON public.bookings;
CREATE TRIGGER selective_email_notifications_trigger
  AFTER UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_selective_email_notifications();