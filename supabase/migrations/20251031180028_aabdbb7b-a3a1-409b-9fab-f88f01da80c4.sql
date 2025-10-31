-- Fix case-sensitivity bug: Change 'SYSTEM' to 'system' in trigger_booking_notifications
-- This fixes the constraint violation that was causing handle-payment-success to fail

CREATE OR REPLACE FUNCTION public.trigger_booking_notifications()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_customer_email TEXT;
  v_customer_name TEXT;
  v_customer_phone TEXT;
  v_worker_email TEXT;
  v_worker_name TEXT;
  v_service_name TEXT;
  v_scheduled_date TEXT;
  v_scheduled_time TEXT;
BEGIN
  -- Get booking details
  SELECT 
    b.customer_email,
    b.customer_name,
    b.customer_phone,
    u.email,
    p.full_name,
    s.name,
    TO_CHAR(b.scheduled_date, 'YYYY-MM-DD'),
    b.scheduled_time
  INTO
    v_customer_email,
    v_customer_name,
    v_customer_phone,
    v_worker_email,
    v_worker_name,
    v_service_name,
    v_scheduled_date,
    v_scheduled_time
  FROM bookings b
  LEFT JOIN profiles p ON b.worker_id = p.id
  LEFT JOIN auth.users u ON p.id = u.id
  LEFT JOIN services s ON b.service_id = s.id
  WHERE b.id = NEW.id;

  -- Send confirmation email to customer when booking is confirmed or payment authorized
  IF NEW.status IN ('confirmed', 'payment_authorized') AND (OLD.status IS NULL OR OLD.status NOT IN ('confirmed', 'payment_authorized')) THEN
    INSERT INTO email_logs (recipient_email, email_type, subject, body, status)
    VALUES (
      v_customer_email,
      'booking_confirmation',
      'Booking Confirmation - ' || v_service_name,
      'Your booking has been confirmed for ' || v_scheduled_date || ' at ' || v_scheduled_time,
      'pending'
    );

    -- Send SMS if phone number exists
    IF v_customer_phone IS NOT NULL THEN
      INSERT INTO sms_logs (recipient_number, message_type, message_body, status)
      VALUES (
        'system',
        'booking_confirmation',
        'Your booking for ' || v_service_name || ' on ' || v_scheduled_date || ' at ' || v_scheduled_time || ' has been confirmed.',
        'pending'
      );
    END IF;
  END IF;

  -- Send worker assignment notification
  IF NEW.worker_id IS NOT NULL AND (OLD.worker_id IS NULL OR OLD.worker_id != NEW.worker_id) THEN
    IF v_worker_email IS NOT NULL THEN
      INSERT INTO email_logs (recipient_email, email_type, subject, body, status)
      VALUES (
        v_worker_email,
        'worker_assignment',
        'New Job Assignment - ' || v_service_name,
        'You have been assigned to a new job on ' || v_scheduled_date || ' at ' || v_scheduled_time || '. Customer: ' || v_customer_name,
        'pending'
      );
    END IF;

    -- Log SMS placeholder for worker
    INSERT INTO sms_logs (recipient_number, message_type, message_body, status)
    VALUES (
      'system',
      'worker_assignment',
      'New job assigned: ' || v_service_name || ' on ' || v_scheduled_date || ' at ' || v_scheduled_time,
      'pending'
    );
  END IF;

  -- Send cancellation notifications
  IF NEW.status = 'cancelled' AND (OLD.status IS NULL OR OLD.status != 'cancelled') THEN
    -- Notify customer
    INSERT INTO email_logs (recipient_email, email_type, subject, body, status)
    VALUES (
      v_customer_email,
      'booking_cancellation',
      'Booking Cancelled - ' || v_service_name,
      'Your booking for ' || v_scheduled_date || ' at ' || v_scheduled_time || ' has been cancelled.',
      'pending'
    );

    IF v_customer_phone IS NOT NULL THEN
      INSERT INTO sms_logs (recipient_number, message_type, message_body, status)
      VALUES (
        'system',
        'booking_cancellation',
        'Your booking for ' || v_service_name || ' on ' || v_scheduled_date || ' has been cancelled.',
        'pending'
      );
    END IF;

    -- Notify worker if assigned
    IF NEW.worker_id IS NOT NULL AND v_worker_email IS NOT NULL THEN
      INSERT INTO email_logs (recipient_email, email_type, subject, body, status)
      VALUES (
        v_worker_email,
        'booking_cancellation',
        'Job Cancelled - ' || v_service_name,
        'The job scheduled for ' || v_scheduled_date || ' at ' || v_scheduled_time || ' has been cancelled.',
        'pending'
      );

      INSERT INTO sms_logs (recipient_number, message_type, message_body, status)
      VALUES (
        'system',
        'booking_cancellation',
        'Job cancelled: ' || v_service_name || ' on ' || v_scheduled_date,
        'pending'
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;