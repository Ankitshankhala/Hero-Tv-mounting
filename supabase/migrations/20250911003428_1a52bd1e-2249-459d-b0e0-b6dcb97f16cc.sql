-- Fix zipcode assignment issues by adding UPDATE trigger and improving auto-assignment

-- Create enhanced trigger function that handles both INSERT and UPDATE
CREATE OR REPLACE FUNCTION public.trigger_auto_assign_worker()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  customer_zipcode TEXT;
  assignment_record RECORD;
BEGIN
  -- Only auto-assign if no worker is already assigned and status allows it
  IF NEW.worker_id IS NULL AND NEW.status IN ('pending', 'payment_authorized', 'confirmed') THEN
    
    -- Extract zipcode from customer or guest info
    customer_zipcode := CASE 
      WHEN NEW.customer_id IS NOT NULL THEN (
        SELECT zip_code FROM users WHERE id = NEW.customer_id
      )
      ELSE NEW.guest_customer_info->>'zipcode'
    END;
    
    -- Only proceed if we have a valid zipcode
    IF customer_zipcode IS NOT NULL AND LENGTH(customer_zipcode) >= 5 THEN
      -- Clean zipcode (take first 5 digits)
      customer_zipcode := LEFT(REGEXP_REPLACE(customer_zipcode, '[^0-9]', '', 'g'), 5);
      
      -- Get service area assignment
      SELECT * INTO assignment_record
      FROM public.get_zip_service_assignment(customer_zipcode);
      
      IF FOUND THEN
        -- Assign worker to booking
        UPDATE public.bookings 
        SET worker_id = assignment_record.worker_id, 
            status = 'confirmed'
        WHERE id = NEW.id;
        
        -- Create worker booking entry
        INSERT INTO public.worker_bookings (booking_id, worker_id, status)
        VALUES (NEW.id, assignment_record.worker_id, 'assigned')
        ON CONFLICT (booking_id, worker_id) DO NOTHING;
        
        -- Log successful assignment
        INSERT INTO public.sms_logs (booking_id, recipient_number, message, status, error_message)
        VALUES (NEW.id, 'system', 
          'Auto-assigned to ' || assignment_record.worker_name || ' (' || assignment_record.area_name || ') for ZIP ' || customer_zipcode, 
          'sent', NULL);
      ELSE
        -- Log for admin attention
        INSERT INTO public.sms_logs (booking_id, recipient_number, message, status, error_message)
        VALUES (NEW.id, 'admin', 
          'No worker coverage for ZIP ' || customer_zipcode || ' - requires manual assignment', 
          'failed', 'No service area coverage');
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Drop existing triggers and recreate with proper UPDATE handling
DROP TRIGGER IF EXISTS auto_assign_worker_trigger ON public.bookings;
DROP TRIGGER IF EXISTS auto_assign_worker_update_trigger ON public.bookings;

-- Create INSERT trigger
CREATE TRIGGER auto_assign_worker_trigger
  AFTER INSERT ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_auto_assign_worker();

-- Create UPDATE trigger for zipcode changes
CREATE TRIGGER auto_assign_worker_update_trigger
  AFTER UPDATE ON public.bookings
  FOR EACH ROW
  WHEN (
    -- Trigger when worker is still null and zipcode might have changed
    NEW.worker_id IS NULL AND (
      -- Guest customer zipcode changed
      (OLD.guest_customer_info->>'zipcode') IS DISTINCT FROM (NEW.guest_customer_info->>'zipcode') OR
      -- Customer ID changed (unlikely but possible)
      OLD.customer_id IS DISTINCT FROM NEW.customer_id
    )
  )
  EXECUTE FUNCTION public.trigger_auto_assign_worker();

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.trigger_auto_assign_worker TO authenticated;
GRANT EXECUTE ON FUNCTION public.trigger_auto_assign_worker TO anon;
GRANT EXECUTE ON FUNCTION public.trigger_auto_assign_worker TO service_role;

-- Create function to manually reassign bookings when service areas change
CREATE OR REPLACE FUNCTION public.reassign_bookings_for_zipcode(p_zipcode TEXT)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  booking_record RECORD;
  assignment_record RECORD;
  reassigned_count INTEGER := 0;
BEGIN
  -- Get service area assignment for the zipcode
  SELECT * INTO assignment_record
  FROM public.get_zip_service_assignment(p_zipcode);
  
  -- Find unassigned bookings in this zipcode
  FOR booking_record IN
    SELECT b.id, b.status
    FROM public.bookings b
    LEFT JOIN public.users u ON b.customer_id = u.id
    WHERE (
      (b.customer_id IS NOT NULL AND u.zip_code = p_zipcode) OR
      (b.customer_id IS NULL AND b.guest_customer_info->>'zipcode' = p_zipcode)
    )
    AND b.worker_id IS NULL
    AND b.status IN ('pending', 'payment_authorized')
  LOOP
    IF assignment_record.worker_id IS NOT NULL THEN
      -- Assign worker to booking
      UPDATE public.bookings 
      SET worker_id = assignment_record.worker_id, 
          status = 'confirmed'
      WHERE id = booking_record.id;
      
      -- Create worker booking entry
      INSERT INTO public.worker_bookings (booking_id, worker_id, status)
      VALUES (booking_record.id, assignment_record.worker_id, 'assigned')
      ON CONFLICT (booking_id, worker_id) DO NOTHING;
      
      reassigned_count := reassigned_count + 1;
      
      -- Log successful assignment
      INSERT INTO public.sms_logs (booking_id, recipient_number, message, status, error_message)
      VALUES (booking_record.id, 'system', 
        'Reassigned to ' || assignment_record.worker_name || ' (' || assignment_record.area_name || ') for ZIP ' || p_zipcode, 
        'sent', NULL);
    END IF;
  END LOOP;
  
  RETURN reassigned_count;
END;
$function$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.reassign_bookings_for_zipcode TO authenticated;
GRANT EXECUTE ON FUNCTION public.reassign_bookings_for_zipcode TO service_role;