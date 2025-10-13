-- PHASE 4: Database-Level Enforcement of ZIP Coverage Validation
-- This migration adds a trigger to ensure bookings are only created when workers are available

-- Create validation function to check ZIP coverage before booking creation
CREATE OR REPLACE FUNCTION public.validate_booking_has_coverage()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  customer_zip TEXT;
  has_coverage BOOLEAN := FALSE;
  worker_count INTEGER := 0;
BEGIN
  -- Skip validation for admin-created bookings with manual payment flag
  IF NEW.requires_manual_payment = TRUE THEN
    RAISE NOTICE 'Skipping coverage validation for manual payment booking %', NEW.id;
    RETURN NEW;
  END IF;

  -- Get customer ZIP code (from user profile or guest info)
  customer_zip := COALESCE(
    (SELECT zip_code FROM public.users WHERE id = NEW.customer_id),
    NEW.guest_customer_info->>'zipcode'
  );

  -- Validate ZIP code format
  IF customer_zip IS NULL OR LENGTH(customer_zip) < 5 THEN
    RAISE EXCEPTION 'Cannot create booking: Invalid or missing ZIP code'
      USING HINT = 'Customer ZIP code is required for service coverage validation';
  END IF;

  -- Check if ZIP has active coverage using existing RPC function
  SELECT public.zip_has_active_coverage(customer_zip) INTO has_coverage;
  
  -- Get worker count for better error messaging
  SELECT public.get_worker_count_by_zip(customer_zip) INTO worker_count;

  -- Block booking if no coverage
  IF NOT has_coverage OR worker_count = 0 THEN
    RAISE EXCEPTION 'Cannot create booking: No service coverage in ZIP code %', customer_zip
      USING 
        HINT = 'This area currently has no available workers. Please choose a different location.',
        DETAIL = format('ZIP: %s, Workers Available: %s', customer_zip, worker_count);
  END IF;

  -- Coverage verified, allow booking creation
  RAISE NOTICE 'Coverage verified for ZIP %: % worker(s) available', customer_zip, worker_count;
  RETURN NEW;
END;
$$;

-- Add trigger on INSERT only (not UPDATE to allow admin fixes)
DROP TRIGGER IF EXISTS enforce_zip_coverage_on_booking ON public.bookings;
CREATE TRIGGER enforce_zip_coverage_on_booking
  BEFORE INSERT ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_booking_has_coverage();

-- Add helpful comment
COMMENT ON FUNCTION public.validate_booking_has_coverage() IS 
'Validates that a ZIP code has active worker coverage before allowing booking creation. Skips validation if requires_manual_payment is TRUE (admin override).';

-- Create index for faster coverage lookups
CREATE INDEX IF NOT EXISTS idx_worker_service_zipcodes_coverage 
ON public.worker_service_zipcodes(zipcode) 
WHERE service_area_id IS NOT NULL;

-- Log migration completion
INSERT INTO public.sms_logs (booking_id, recipient_number, message, status, error_message)
VALUES (NULL, 'system', 'Database validation trigger for ZIP coverage installed', 'sent', NULL);