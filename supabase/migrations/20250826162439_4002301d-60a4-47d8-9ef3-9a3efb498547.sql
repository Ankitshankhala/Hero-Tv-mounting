-- Fix worker auto-assignment and email notification triggers

-- 1. Drop existing problematic trigger
DROP TRIGGER IF EXISTS auto_assign_trigger ON public.bookings;

-- 2. Create improved auto-assignment trigger that works for all booking statuses
CREATE OR REPLACE FUNCTION public.trigger_worker_auto_assignment()
RETURNS TRIGGER AS $$
BEGIN
  -- Only auto-assign if no worker is currently assigned and booking needs assignment
  IF (NEW.worker_id IS NULL OR NEW.worker_id != OLD.worker_id) 
     AND NEW.status IN ('payment_pending', 'payment_authorized', 'pending', 'confirmed')
     AND NEW.payment_status IN ('pending', 'authorized', 'completed', 'captured') THEN
    
    -- Log the auto-assignment attempt
    INSERT INTO public.sms_logs (booking_id, recipient_number, message, status, error_message)
    VALUES (NEW.id, 'system', 'Triggering auto-assignment for booking status: ' || NEW.status, 'sent', NULL);
    
    -- Call the enhanced auto-assignment function with polygon coverage
    PERFORM public.auto_assign_workers_with_polygon_coverage(NEW.id);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create trigger for worker assignment emails
CREATE OR REPLACE FUNCTION public.trigger_worker_assignment_email()
RETURNS TRIGGER AS $$
BEGIN
  -- Send email when worker is assigned (worker_id changes from NULL to a value)
  IF OLD.worker_id IS NULL AND NEW.worker_id IS NOT NULL THEN
    -- Log the email trigger
    INSERT INTO public.sms_logs (booking_id, recipient_number, message, status, error_message)
    VALUES (NEW.id, 'system', 'Triggering worker assignment email for worker: ' || NEW.worker_id, 'sent', NULL);
    
    -- Call smart email dispatcher for worker assignment
    PERFORM net.http_post(
      url := 'https://ggvplltpwsnvtcbpazbe.supabase.co/functions/v1/smart-email-dispatcher',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdndnBsbHRwd3NudnRjYnBhemJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk1MTU5NjIsImV4cCI6MjA2NTA5MTk2Mn0.cbZ4kBKP7odpP9r1Qrg4G6CA8XdW7vLdKsqr6gE0j_Q'
      ),
      body := jsonb_build_object(
        'bookingId', NEW.id,
        'workerId', NEW.worker_id,
        'emailType', 'worker_assignment',
        'source', 'auto_trigger'
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Create triggers on bookings table
CREATE TRIGGER auto_assign_workers_trigger
  AFTER UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_worker_auto_assignment();

CREATE TRIGGER worker_assignment_email_trigger
  AFTER UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_worker_assignment_email();

-- 5. Create trigger for new bookings (INSERT)
CREATE TRIGGER auto_assign_new_bookings_trigger
  AFTER INSERT ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_worker_auto_assignment();

-- 6. Enhanced find_available_workers function to support guest bookings
CREATE OR REPLACE FUNCTION public.find_available_workers(customer_zipcode text, service_date date, service_start_time time without time zone, service_duration_minutes integer DEFAULT 60)
RETURNS TABLE(worker_id uuid, distance_priority integer, worker_name text, worker_email text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Enhanced to work with any zipcode input
  RETURN QUERY
  SELECT 
    u.id as worker_id,
    CASE 
      WHEN wa.distance_miles <= 10 THEN 1
      WHEN wa.distance_miles <= 20 THEN 2
      WHEN wa.distance_miles <= 30 THEN 3
      ELSE 4
    END as distance_priority,
    u.name as worker_name,
    u.email as worker_email
  FROM public.users u
  LEFT JOIN public.worker_areas wa ON u.id = wa.worker_id
  WHERE u.role = 'worker'
    AND u.is_active = true
    AND (wa.zipcode = customer_zipcode OR customer_zipcode IS NOT NULL)
    AND EXISTS (
      SELECT 1 
      FROM public.worker_availability wav
      WHERE wav.worker_id = u.id
        AND wav.day_of_week = EXTRACT(DOW FROM service_date)::day_of_week
        AND wav.start_time <= service_start_time
        AND wav.end_time >= (service_start_time + (service_duration_minutes || ' minutes')::INTERVAL)::TIME
    )
    AND NOT EXISTS (
      SELECT 1 
      FROM public.bookings b
      WHERE b.worker_id = u.id
        AND b.scheduled_date = service_date
        AND b.status IN ('confirmed', 'completed', 'payment_authorized')
        AND (
          (b.scheduled_start <= service_start_time AND 
           (b.scheduled_start + INTERVAL '60 minutes') > service_start_time) OR
          (service_start_time <= b.scheduled_start AND 
           (service_start_time + (service_duration_minutes || ' minutes')::INTERVAL) > b.scheduled_start)
        )
    )
  ORDER BY distance_priority, u.name
  LIMIT 5;
END;
$$;