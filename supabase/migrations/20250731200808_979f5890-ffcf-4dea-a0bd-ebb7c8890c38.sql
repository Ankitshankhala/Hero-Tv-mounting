-- Fix the auto_assign_worker function to use the correct signature
-- This is likely the source of the enum error

CREATE OR REPLACE FUNCTION public.auto_assign_worker()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  available_worker_record RECORD;
  service_duration INTEGER := 60; -- Default 1 hour duration
  customer_zipcode TEXT;
BEGIN
  -- Only try to assign if no worker is already assigned
  IF NEW.worker_id IS NULL AND NEW.status = 'pending' THEN
    -- Get customer zipcode
    SELECT zip_code INTO customer_zipcode 
    FROM users 
    WHERE id = NEW.customer_id;
    
    -- Use the correct find_available_workers signature
    SELECT * INTO available_worker_record
    FROM find_available_workers(
      customer_zipcode,
      NEW.scheduled_date,
      NEW.scheduled_start,
      service_duration
    )
    LIMIT 1;
    
    IF available_worker_record.worker_id IS NOT NULL THEN
      NEW.worker_id := available_worker_record.worker_id;
      NEW.status := 'confirmed'::booking_status;  -- Explicitly cast to enum
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;