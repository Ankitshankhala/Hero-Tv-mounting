-- Add index for fast ZIP lookups
CREATE INDEX IF NOT EXISTS idx_worker_service_zipcodes_zipcode ON worker_service_zipcodes(zipcode);

-- Function to get service area assignment for a ZIP code
CREATE OR REPLACE FUNCTION public.get_zip_service_assignment(p_zip text)
RETURNS TABLE(
  area_id uuid,
  area_name text,
  worker_id uuid,
  worker_name text,
  is_active boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    wsa.id as area_id,
    wsa.area_name,
    wsa.worker_id,
    u.name as worker_name,
    wsa.is_active
  FROM worker_service_zipcodes wsz
  INNER JOIN worker_service_areas wsa ON wsz.service_area_id = wsa.id
  INNER JOIN users u ON wsa.worker_id = u.id
  WHERE wsz.zipcode = p_zip 
    AND wsa.is_active = true
    AND u.is_active = true
  ORDER BY wsa.updated_at DESC, wsa.created_at DESC
  LIMIT 1;
END;
$function$;

-- Function to auto-assign worker based on ZIP code
CREATE OR REPLACE FUNCTION public.auto_assign_worker_by_zip(p_booking_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  booking_record RECORD;
  customer_zipcode TEXT;
  assignment_record RECORD;
BEGIN
  -- Get booking and customer ZIP
  SELECT 
    b.*,
    CASE 
      WHEN b.customer_id IS NOT NULL THEN u.zip_code
      ELSE b.guest_customer_info->>'zipcode'
    END as zipcode
  INTO booking_record
  FROM public.bookings b
  LEFT JOIN public.users u ON b.customer_id = u.id
  WHERE b.id = p_booking_id;
  
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  customer_zipcode := booking_record.zipcode;
  
  -- Validate ZIP exists
  IF customer_zipcode IS NULL OR LENGTH(customer_zipcode) < 5 THEN
    INSERT INTO public.sms_logs (booking_id, recipient_number, message, status, error_message)
    VALUES (p_booking_id, 'system', 'No valid ZIP code found for auto-assignment', 'failed', NULL);
    RETURN FALSE;
  END IF;
  
  -- Get service area assignment
  SELECT * INTO assignment_record
  FROM public.get_zip_service_assignment(customer_zipcode);
  
  IF FOUND THEN
    -- Assign worker to booking
    UPDATE public.bookings 
    SET worker_id = assignment_record.worker_id, 
        status = 'confirmed'
    WHERE id = p_booking_id;
    
    -- Create worker booking entry
    INSERT INTO public.worker_bookings (booking_id, worker_id, status)
    VALUES (p_booking_id, assignment_record.worker_id, 'assigned');
    
    -- Log successful assignment
    INSERT INTO public.sms_logs (booking_id, recipient_number, message, status, error_message)
    VALUES (p_booking_id, 'system', 
      'Auto-assigned to ' || assignment_record.worker_name || ' (' || assignment_record.area_name || ') for ZIP ' || customer_zipcode, 
      'sent', NULL);
    
    RETURN TRUE;
  ELSE
    -- No worker found for ZIP
    UPDATE public.bookings 
    SET status = 'pending'
    WHERE id = p_booking_id;
    
    -- Log for admin attention
    INSERT INTO public.sms_logs (booking_id, recipient_number, message, status, error_message)
    VALUES (p_booking_id, 'admin', 
      'No worker coverage for ZIP ' || customer_zipcode || ' - requires manual assignment', 
      'failed', 'No service area coverage');
    
    RETURN FALSE;
  END IF;
END;
$function$;

-- Trigger to auto-assign worker after booking creation
CREATE OR REPLACE FUNCTION public.trigger_auto_assign_worker()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Only auto-assign if no worker is already assigned and status allows it
  IF NEW.worker_id IS NULL AND NEW.status IN ('pending', 'payment_authorized', 'confirmed') THEN
    PERFORM public.auto_assign_worker_by_zip(NEW.id);
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create trigger on bookings table
DROP TRIGGER IF EXISTS auto_assign_worker_trigger ON public.bookings;
CREATE TRIGGER auto_assign_worker_trigger
  AFTER INSERT ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_auto_assign_worker();