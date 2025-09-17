-- Migration script to convert existing ZIP code data to ZCTA-only approach
-- This script ensures backward compatibility while transitioning to ZCTA-only system

-- =====================================================
-- PART 1: Data Validation and Cleanup
-- =====================================================

-- Create temporary table to track migration progress
CREATE TABLE IF NOT EXISTS migration_progress (
  id SERIAL PRIMARY KEY,
  step_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  details JSONB
);

-- Log migration start
INSERT INTO migration_progress (step_name, status) 
VALUES ('zcta_migration_start', 'started');

-- Function to log migration steps
CREATE OR REPLACE FUNCTION log_migration_step(
  p_step_name TEXT,
  p_status TEXT,
  p_details JSONB DEFAULT NULL,
  p_error TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO migration_progress (step_name, status, details, error_message, completed_at)
  VALUES (p_step_name, p_status, p_details, p_error, 
    CASE WHEN p_status IN ('completed', 'failed') THEN now() ELSE NULL END);
END;
$$;

-- =====================================================
-- PART 2: Validate Existing Worker Service Areas
-- =====================================================

-- Check current state of worker service areas
DO $$
DECLARE
  total_workers INTEGER;
  total_areas INTEGER;
  total_zipcodes INTEGER;
  invalid_zipcodes INTEGER;
BEGIN
  -- Count current data
  SELECT COUNT(*) INTO total_workers FROM users WHERE role = 'worker' AND is_active = true;
  SELECT COUNT(*) INTO total_areas FROM worker_service_areas WHERE is_active = true;
  SELECT COUNT(*) INTO total_zipcodes FROM worker_service_zipcodes;
  
  -- Count invalid ZIP codes (not 5 digits)
  SELECT COUNT(*) INTO invalid_zipcodes 
  FROM worker_service_zipcodes 
  WHERE LENGTH(REGEXP_REPLACE(zipcode, '[^0-9]', '', 'g')) != 5;
  
  -- Log current state
  PERFORM log_migration_step(
    'validate_existing_data',
    'completed',
    jsonb_build_object(
      'total_workers', total_workers,
      'total_areas', total_areas,
      'total_zipcodes', total_zipcodes,
      'invalid_zipcodes', invalid_zipcodes
    )
  );
END;
$$;

-- =====================================================
-- PART 3: Clean Up Invalid ZIP Codes
-- =====================================================

-- Clean up worker service zipcodes - ensure all are 5-digit format
UPDATE worker_service_zipcodes 
SET zipcode = LEFT(REGEXP_REPLACE(zipcode, '[^0-9]', '', 'g'), 5)
WHERE LENGTH(REGEXP_REPLACE(zipcode, '[^0-9]', '', 'g')) >= 5;

-- Remove invalid ZIP codes (less than 5 digits after cleaning)
DELETE FROM worker_service_zipcodes 
WHERE LENGTH(REGEXP_REPLACE(zipcode, '[^0-9]', '', 'g')) < 5;

-- Log cleanup results
DO $$
DECLARE
  remaining_zipcodes INTEGER;
BEGIN
  SELECT COUNT(*) INTO remaining_zipcodes FROM worker_service_zipcodes;
  
  PERFORM log_migration_step(
    'cleanup_invalid_zipcodes',
    'completed',
    jsonb_build_object('remaining_zipcodes', remaining_zipcodes)
  );
END;
$$;

-- =====================================================
-- PART 4: Validate ZIP Codes Against ZCTA Data
-- =====================================================

-- Create temporary table to track ZIP code validation
CREATE TEMP TABLE zipcode_validation AS
SELECT DISTINCT 
  wsz.zipcode,
  COUNT(*) as usage_count,
  EXISTS(SELECT 1 FROM us_zcta_polygons WHERE zcta5ce = wsz.zipcode) as has_zcta_boundary,
  EXISTS(SELECT 1 FROM us_zip_codes WHERE zipcode = wsz.zipcode) as has_postal_data
FROM worker_service_zipcodes wsz
GROUP BY wsz.zipcode;

-- Log validation results
DO $$
DECLARE
  total_unique_zips INTEGER;
  zcta_boundary_count INTEGER;
  postal_only_count INTEGER;
  no_data_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_unique_zips FROM zipcode_validation;
  SELECT COUNT(*) INTO zcta_boundary_count FROM zipcode_validation WHERE has_zcta_boundary = true;
  SELECT COUNT(*) INTO postal_only_count FROM zipcode_validation WHERE has_zcta_boundary = false AND has_postal_data = true;
  SELECT COUNT(*) INTO no_data_count FROM zipcode_validation WHERE has_zcta_boundary = false AND has_postal_data = false;
  
  PERFORM log_migration_step(
    'validate_against_zcta_data',
    'completed',
    jsonb_build_object(
      'total_unique_zips', total_unique_zips,
      'zcta_boundary_count', zcta_boundary_count,
      'postal_only_count', postal_only_count,
      'no_data_count', no_data_count
    )
  );
END;
$$;

-- =====================================================
-- PART 5: Update Existing Functions to Use ZCTA
-- =====================================================

-- Update trigger for auto-assignment to use new ZCTA function
CREATE OR REPLACE FUNCTION public.trigger_auto_assign_worker()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  assignment_record RECORD;
  customer_zipcode TEXT;
BEGIN
  -- Only process INSERT operations for pending bookings
  IF TG_OP = 'INSERT' AND NEW.status = 'pending' AND NEW.worker_id IS NULL THEN
    -- Get customer zipcode
    customer_zipcode := CASE 
      WHEN NEW.customer_id IS NOT NULL THEN 
        (SELECT zip_code FROM users WHERE id = NEW.customer_id)
      ELSE 
        NEW.guest_customer_info->>'zipcode'
    END;
    
    -- Only proceed if we have a valid zipcode
    IF customer_zipcode IS NOT NULL AND LENGTH(customer_zipcode) >= 5 THEN
      -- Clean zipcode (take first 5 digits)
      customer_zipcode := LEFT(REGEXP_REPLACE(customer_zipcode, '[^0-9]', '', 'g'), 5);
      
      -- Use enhanced ZCTA auto-assignment
      BEGIN
        SELECT * INTO assignment_record
        FROM auto_assign_worker_zcta_enhanced(NEW.id)
        LIMIT 1;
        
        -- Log assignment result
        INSERT INTO public.sms_logs (booking_id, recipient_number, message, status, error_message)
        VALUES (NEW.id, 'system', 
          'ZCTA auto-assignment: ' || COALESCE(assignment_record.assignment_status, 'failed') || 
          ' for ZIP ' || customer_zipcode, 
          CASE WHEN assignment_record.assigned_worker_id IS NOT NULL THEN 'sent' ELSE 'failed' END,
          CASE WHEN assignment_record.assigned_worker_id IS NULL THEN 'No worker coverage' ELSE NULL END);
          
      EXCEPTION WHEN OTHERS THEN
        -- Log error but don't fail the booking creation
        INSERT INTO public.sms_logs (booking_id, recipient_number, message, status, error_message)
        VALUES (NEW.id, 'admin', 
          'ZCTA auto-assignment failed for ZIP ' || customer_zipcode, 
          'failed', SQLERRM);
      END;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- =====================================================
-- PART 6: Create Backward Compatibility Views
-- =====================================================

-- Create view for existing booking queries
CREATE OR REPLACE VIEW booking_worker_assignments AS
SELECT 
  b.id as booking_id,
  b.customer_id,
  b.worker_id,
  b.status,
  b.scheduled_date,
  b.scheduled_start,
  COALESCE(u.zip_code, b.guest_customer_info->>'zipcode') as customer_zipcode,
  w.name as worker_name,
  w.email as worker_email,
  w.phone as worker_phone,
  wsa.area_name,
  wsa.id as area_id,
  (
    SELECT jsonb_build_object(
      'is_valid', v.is_valid,
      'city', v.city,
      'state', v.state,
      'data_source', v.data_source,
      'has_boundary_data', v.has_boundary_data
    )
    FROM validate_zcta_code(LEFT(REGEXP_REPLACE(COALESCE(u.zip_code, b.guest_customer_info->>'zipcode', ''), '[^0-9]', '', 'g'), 5)) v
    LIMIT 1
  ) as zcta_validation
FROM bookings b
LEFT JOIN users u ON b.customer_id = u.id
LEFT JOIN users w ON b.worker_id = w.id
LEFT JOIN worker_service_zipcodes wsz ON w.id = wsz.worker_id 
  AND wsz.zipcode = LEFT(REGEXP_REPLACE(COALESCE(u.zip_code, b.guest_customer_info->>'zipcode', ''), '[^0-9]', '', 'g'), 5)
LEFT JOIN worker_service_areas wsa ON wsz.service_area_id = wsa.id;

-- =====================================================
-- PART 7: Create Data Migration Report Function
-- =====================================================

CREATE OR REPLACE FUNCTION public.generate_zcta_migration_report()
RETURNS TABLE(
  section TEXT,
  metric TEXT,
  value TEXT,
  status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Migration Progress
  RETURN QUERY
  SELECT 
    'Migration Progress'::TEXT as section,
    mp.step_name as metric,
    mp.status as value,
    CASE 
      WHEN mp.status = 'completed' THEN 'success'
      WHEN mp.status = 'failed' THEN 'error'
      ELSE 'info'
    END as status
  FROM migration_progress mp
  ORDER BY mp.started_at;
  
  -- Current System State
  RETURN QUERY
  SELECT 
    'System State'::TEXT as section,
    'Total Active Workers'::TEXT as metric,
    (SELECT COUNT(*)::TEXT FROM users WHERE role = 'worker' AND is_active = true) as value,
    'info'::TEXT as status
  UNION ALL
  SELECT 
    'System State'::TEXT,
    'Active Service Areas'::TEXT,
    (SELECT COUNT(*)::TEXT FROM worker_service_areas WHERE is_active = true) as value,
    'info'::TEXT
  UNION ALL
  SELECT 
    'System State'::TEXT,
    'Total ZCTA Assignments'::TEXT,
    (SELECT COUNT(*)::TEXT FROM worker_service_zipcodes) as value,
    'info'::TEXT;
    
  -- ZCTA Coverage
  RETURN QUERY
  SELECT 
    'ZCTA Coverage'::TEXT as section,
    'Available ZCTA Codes'::TEXT as metric,
    (SELECT COUNT(*)::TEXT FROM us_zcta_polygons) as value,
    'info'::TEXT as status
  UNION ALL
  SELECT 
    'ZCTA Coverage'::TEXT,
    'Covered ZCTA Codes'::TEXT,
    (SELECT COUNT(DISTINCT zipcode)::TEXT FROM worker_service_zipcodes) as value,
    'success'::TEXT
  UNION ALL
  SELECT 
    'ZCTA Coverage'::TEXT,
    'Coverage Percentage'::TEXT,
    (
      SELECT ROUND(
        (SELECT COUNT(DISTINCT zipcode)::NUMERIC FROM worker_service_zipcodes) * 100.0 / 
        NULLIF((SELECT COUNT(*)::NUMERIC FROM us_zcta_polygons), 0), 
        2
      )::TEXT || '%'
    ) as value,
    'info'::TEXT;
    
  -- Data Quality
  RETURN QUERY
  SELECT 
    'Data Quality'::TEXT as section,
    'ZCTA Codes with Boundary Data'::TEXT as metric,
    (
      SELECT COUNT(DISTINCT wsz.zipcode)::TEXT 
      FROM worker_service_zipcodes wsz
      WHERE EXISTS(SELECT 1 FROM us_zcta_polygons WHERE zcta5ce = wsz.zipcode)
    ) as value,
    'success'::TEXT as status
  UNION ALL
  SELECT 
    'Data Quality'::TEXT,
    'ZCTA Codes with Postal Data Only'::TEXT,
    (
      SELECT COUNT(DISTINCT wsz.zipcode)::TEXT 
      FROM worker_service_zipcodes wsz
      WHERE NOT EXISTS(SELECT 1 FROM us_zcta_polygons WHERE zcta5ce = wsz.zipcode)
      AND EXISTS(SELECT 1 FROM us_zip_codes WHERE zipcode = wsz.zipcode)
    ) as value,
    'warning'::TEXT
  UNION ALL
  SELECT 
    'Data Quality'::TEXT,
    'ZCTA Codes with No Data'::TEXT,
    (
      SELECT COUNT(DISTINCT wsz.zipcode)::TEXT 
      FROM worker_service_zipcodes wsz
      WHERE NOT EXISTS(SELECT 1 FROM us_zcta_polygons WHERE zcta5ce = wsz.zipcode)
      AND NOT EXISTS(SELECT 1 FROM us_zip_codes WHERE zipcode = wsz.zipcode)
    ) as value,
    'error'::TEXT;
END;
$$;

-- =====================================================
-- PART 8: Finalize Migration
-- =====================================================

-- Update all existing bookings to use ZCTA validation in notes
UPDATE bookings 
SET notes = COALESCE(notes, '') || ' [Migrated to ZCTA-only system]'
WHERE status IN ('confirmed', 'completed') 
AND worker_id IS NOT NULL
AND notes NOT LIKE '%ZCTA-only system%';

-- Log final migration status
DO $$
DECLARE
  final_report JSONB;
BEGIN
  -- Generate final report
  SELECT jsonb_agg(
    jsonb_build_object(
      'section', section,
      'metric', metric, 
      'value', value,
      'status', status
    )
  ) INTO final_report
  FROM generate_zcta_migration_report();
  
  -- Log migration completion
  PERFORM log_migration_step(
    'zcta_migration_complete',
    'completed',
    jsonb_build_object(
      'migration_completed_at', now(),
      'final_report', final_report
    )
  );
END;
$$;

-- Grant permissions for new functions
GRANT EXECUTE ON FUNCTION generate_zcta_migration_report TO authenticated;
GRANT EXECUTE ON FUNCTION log_migration_step TO authenticated;

-- Add helpful comments
COMMENT ON FUNCTION generate_zcta_migration_report IS 'Generate comprehensive ZCTA migration report';
COMMENT ON TABLE migration_progress IS 'Track ZCTA migration progress and status';
COMMENT ON VIEW booking_worker_assignments IS 'Backward compatible view for booking assignments with ZCTA validation';

-- Clean up temporary objects
DROP TABLE IF EXISTS zipcode_validation;
