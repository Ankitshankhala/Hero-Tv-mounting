
-- 1) Replace pg_net.http_post with net.http_post in trigger_manual_worker_assignment
CREATE OR REPLACE FUNCTION public.trigger_manual_worker_assignment(p_booking_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  -- Call the assign-authorized-booking-worker edge function
  PERFORM net.http_post(
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

-- 2) Replace pg_net.http_post with net.http_post in notify_worker_assignment
CREATE OR REPLACE FUNCTION public.notify_worker_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Only trigger when worker_id changes from NULL to a value (new assignment)
  IF OLD.worker_id IS NULL AND NEW.worker_id IS NOT NULL THEN
    -- Update booking status to confirmed when worker is assigned
    UPDATE public.bookings 
    SET status = 'confirmed'
    WHERE id = NEW.id;
    
    -- Call worker assignment email notification function
    PERFORM net.http_post(
      url := 'https://ggvplltpwsnvtcbpazbe.supabase.co/functions/v1/send-worker-assignment-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdndnBsbHRwd3NudnRjYnBhemJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk1MTU5NjIsImV4cCI6MjA2NTA5MTk2Mn0.cbZ4kBKP7odpP9r1Qrg4G6CA8XdW7vLdKsqr6gE0j_Q'
      ),
      body := jsonb_build_object(
        'bookingId', NEW.id::text,
        'workerId', NEW.worker_id::text
      )
    );
    
    -- Call SMS notification function
    PERFORM net.http_post(
      url := 'https://ggvplltpwsnvtcbpazbe.supabase.co/functions/v1/send-sms-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdndnBsbHRwd3NudnRjYnBhemJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk1MTU5NjIsImV4cCI6MjA2NTA5MTk2Mn0.cbZ4kBKP7odpP9r1Qrg4G6CA8XdW7vLdKsqr6gE0j_Q'
      ),
      body := jsonb_build_object('bookingId', NEW.id::text)
    );
    
    -- Log the assignment for debugging
    INSERT INTO public.sms_logs (booking_id, recipient_number, message, status, error_message)
    VALUES (NEW.id, 'system', 'Worker assigned via trigger - email and SMS notifications sent', 'sent', NULL);
  END IF;
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log any errors but don't fail the booking update
  INSERT INTO public.sms_logs (booking_id, recipient_number, message, status, error_message)
  VALUES (NEW.id, 'system', 'Worker assignment notification failed', 'failed', SQLERRM);
  RETURN NEW;
END;
$function$;

-- 3) Replace pg_net.http_post with net.http_post in trigger_booking_notifications
CREATE OR REPLACE FUNCTION public.trigger_booking_notifications()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Fire only when a worker gets assigned (NULL -> NOT NULL)
  IF (TG_OP = 'INSERT' AND NEW.worker_id IS NOT NULL) OR
     (TG_OP = 'UPDATE' AND (OLD.worker_id IS NULL AND NEW.worker_id IS NOT NULL)) THEN

    -- Ensure booking is confirmed
    IF NEW.status != 'confirmed' THEN
      UPDATE public.bookings 
      SET status = 'confirmed'
      WHERE id = NEW.id;
    END IF;

    -- Worker assignment email
    PERFORM net.http_post(
      url := 'https://ggvplltpwsnvtcbpazbe.supabase.co/functions/v1/send-worker-assignment-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdndnBsbHRwd3NudnRjYnBhemJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk1MTU5NjIsImV4cCI6MjA2NTA5MTk2Mn0.cbZ4kBKP7odpP9r1Qrg4G6CA8XdW7vLdKsqr6gE0j_Q'
      ),
      body := jsonb_build_object(
        'bookingId', NEW.id::text,
        'workerId', NEW.worker_id::text
      )
    );

    -- Worker SMS
    PERFORM net.http_post(
      url := 'https://ggvplltpwsnvtcbpazbe.supabase.co/functions/v1/send-sms-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdndnBsbHRwd3NudnRjYnBhemJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk1MTU5NjIsImV4cCI6MjA2NTA5MTk2Mn0.cbZ4kBKP7odpP9r1Qrg4G6CA8XdW7vLdKsqr6gE0j_Q'
      ),
      body := jsonb_build_object('bookingId', NEW.id::text)
    );

    -- Customer email (will include worker details if available)
    PERFORM net.http_post(
      url := 'https://ggvplltpwsnvtcbpazbe.supabase.co/functions/v1/send-customer-booking-confirmation',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdndnBsbHRwd3NudnRjYnBhemJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk1MTU5NjIsImV4cCI6MjA2NTA5MTk2Mn0.cbZ4kBKP7odpP9r1Qrg4G6CA8XdW7vLdKsqr6gE0j_Q'
      ),
      body := jsonb_build_object('bookingId', NEW.id::text)
    );

    -- Customer SMS with worker details
    PERFORM net.http_post(
      url := 'https://ggvplltpwsnvtcbpazbe.supabase.co/functions/v1/send-customer-worker-sms',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdndnBsbHRwd3NudnRjYnBhemJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk1MTU5NjIsImV4cCI6MjA2NTA5MTk2Mn0.cbZ4kBKP7odpP9r1Qrg4G6CA8XdW7vLdKsqr6gE0j_Q'
      ),
      body := jsonb_build_object('bookingId', NEW.id::text)
    );

    -- Log consolidated notification
    INSERT INTO public.sms_logs (booking_id, recipient_number, message, status, error_message)
    VALUES (NEW.id, 'system', 'Worker assignment: worker+customer notifications sent', 'sent', NULL);
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  INSERT INTO public.sms_logs (booking_id, recipient_number, message, status, error_message)
  VALUES (NEW.id, 'system', 'Notification trigger failed', 'failed', SQLERRM);
  RETURN NEW;
END;
$function$;

-- 4) Replace pg_net.http_post with net.http_post in trigger_auto_invoice
CREATE OR REPLACE FUNCTION public.trigger_auto_invoice()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Call the auto-invoice edge function via net.http_post using anon key
  PERFORM net.http_post(
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
    NEW.id,
    'system',
    'Auto-invoice trigger failed',
    'failed',
    SQLERRM
  );
  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- 5) Replace pg_net.http_post with net.http_post in trigger_invoice_on_payment_capture
CREATE OR REPLACE FUNCTION public.trigger_invoice_on_payment_capture()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Only trigger when payment status changes to 'completed' (captured)
  IF NEW.status = 'completed' AND OLD.status != 'completed' AND NEW.transaction_type = 'capture' THEN
    
    -- Check if invoice already exists to prevent duplicates
    IF NOT EXISTS (
      SELECT 1 FROM invoices WHERE booking_id = NEW.booking_id
    ) THEN
      -- Call the enhanced generate-invoice function
      PERFORM net.http_post(
        url := 'https://ggvplltpwsnvtcbpazbe.supabase.co/functions/v1/enhanced-invoice-generator',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdndnBsbHRwd3NudnRjYnBhemJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk1MTU5NjIsImV4cCI6MjA2NTA5MTk2Mn0.cbZ4kBKP7odpP9r1Qrg4G6CA8XdW7vLdKsqr6gE0j_Q'
        ),
        body := jsonb_build_object(
          'booking_id', NEW.booking_id,
          'transaction_id', NEW.id,
          'trigger_source', 'payment_capture',
          'send_email', true
        )
      );
      
      -- Log the invoice generation trigger
      INSERT INTO sms_logs (booking_id, recipient_number, message, status, error_message)
      VALUES (
        NEW.booking_id, 
        'system', 
        'Invoice generation triggered by payment capture', 
        'sent', 
        NULL
      );
    END IF;
  END IF;
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log error but don't fail the transaction
  INSERT INTO sms_logs (booking_id, recipient_number, message, status, error_message)
  VALUES (
    NEW.booking_id, 
    'system', 
    'Invoice generation trigger failed', 
    'failed', 
    SQLERRM
  );
  RETURN NEW;
END;
$function$;
