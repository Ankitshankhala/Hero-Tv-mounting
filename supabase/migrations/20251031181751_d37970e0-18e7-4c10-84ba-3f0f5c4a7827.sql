-- Fix trigger_booking_notifications to use correct email_logs columns (message, booking_id)
CREATE OR REPLACE FUNCTION public.trigger_booking_notifications()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_customer_email TEXT;
  v_customer_name TEXT;
  v_worker_email TEXT;
  v_worker_name TEXT;
  v_service_name TEXT;
  v_scheduled_date TEXT;
  v_scheduled_time TEXT;
BEGIN
  -- Get customer info from users table or guest_customer_info JSON
  v_customer_email := COALESCE(
    (SELECT email FROM public.users WHERE id = NEW.customer_id),
    NEW.guest_customer_info->>'email'
  );
  
  v_customer_name := COALESCE(
    (SELECT name FROM public.users WHERE id = NEW.customer_id),
    NEW.guest_customer_info->>'name'
  );
  
  -- Get worker info from users table
  IF NEW.worker_id IS NOT NULL THEN
    SELECT email, name INTO v_worker_email, v_worker_name
    FROM public.users
    WHERE id = NEW.worker_id;
  END IF;
  
  -- Get service name
  SELECT name INTO v_service_name
  FROM public.services
  WHERE id = NEW.service_id;
  
  -- Format scheduled date and time
  v_scheduled_date := TO_CHAR(NEW.scheduled_date, 'YYYY-MM-DD');
  v_scheduled_time := COALESCE(NEW.scheduled_start::text, '');
  
  -- Send confirmation email to customer when booking is confirmed or payment authorized
  IF NEW.status IN ('confirmed', 'payment_authorized') 
     AND (OLD.status IS NULL OR OLD.status NOT IN ('confirmed', 'payment_authorized'))
     AND v_customer_email IS NOT NULL THEN
    INSERT INTO public.email_logs (booking_id, recipient_email, email_type, subject, message, status)
    VALUES (
      NEW.id,
      v_customer_email,
      'booking_confirmation',
      'Booking Confirmation - ' || COALESCE(v_service_name, 'Service'),
      'Your booking has been confirmed for ' || v_scheduled_date || 
      CASE WHEN v_scheduled_time <> '' THEN ' at ' || v_scheduled_time ELSE '' END || '.',
      'pending'
    );
  END IF;
  
  -- Send worker assignment notification
  IF NEW.worker_id IS NOT NULL 
     AND (OLD.worker_id IS NULL OR OLD.worker_id != NEW.worker_id)
     AND v_worker_email IS NOT NULL THEN
    INSERT INTO public.email_logs (booking_id, recipient_email, email_type, subject, message, status)
    VALUES (
      NEW.id,
      v_worker_email,
      'worker_assignment',
      'New Job Assignment - ' || COALESCE(v_service_name, 'Service'),
      'You have been assigned to a new job on ' || v_scheduled_date ||
      CASE WHEN v_scheduled_time <> '' THEN ' at ' || v_scheduled_time ELSE '' END ||
      '. Customer: ' || COALESCE(v_customer_name, ''),
      'pending'
    );
  END IF;
  
  -- Send cancellation notification to customer
  IF NEW.status = 'cancelled' 
     AND (OLD.status IS NULL OR OLD.status != 'cancelled')
     AND v_customer_email IS NOT NULL THEN
    INSERT INTO public.email_logs (booking_id, recipient_email, email_type, subject, message, status)
    VALUES (
      NEW.id,
      v_customer_email,
      'booking_cancellation',
      'Booking Cancelled - ' || COALESCE(v_service_name, 'Service'),
      'Your booking for ' || v_scheduled_date ||
      CASE WHEN v_scheduled_time <> '' THEN ' at ' || v_scheduled_time ELSE '' END ||
      ' has been cancelled.',
      'pending'
    );
  END IF;
  
  -- Send cancellation notification to worker if assigned
  IF NEW.status = 'cancelled'
     AND (OLD.status IS NULL OR OLD.status != 'cancelled')
     AND NEW.worker_id IS NOT NULL
     AND v_worker_email IS NOT NULL THEN
    INSERT INTO public.email_logs (booking_id, recipient_email, email_type, subject, message, status)
    VALUES (
      NEW.id,
      v_worker_email,
      'booking_cancellation',
      'Job Cancelled - ' || COALESCE(v_service_name, 'Service'),
      'The job scheduled for ' || v_scheduled_date ||
      CASE WHEN v_scheduled_time <> '' THEN ' at ' || v_scheduled_time ELSE '' END ||
      ' has been cancelled.',
      'pending'
    );
  END IF;
  
  RETURN NEW;
  
EXCEPTION WHEN OTHERS THEN
  -- Never block booking/payment flows due to notification failures
  RAISE NOTICE 'trigger_booking_notifications error: %', SQLERRM;
  RETURN NEW;
END;
$$;