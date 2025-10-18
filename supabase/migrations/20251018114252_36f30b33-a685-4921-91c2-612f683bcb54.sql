-- Fix compute_zipcodes_for_service_area to prevent deleting other workers' ZIP codes
-- Root cause: DELETE was not scoped by worker_id, causing cross-worker ZIP removal

-- Add unique constraint to prevent duplicate worker-zipcode combinations
-- while still allowing multiple workers to serve the same ZIP
ALTER TABLE worker_service_zipcodes 
DROP CONSTRAINT IF EXISTS worker_service_zipcodes_service_area_id_zipcode_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_worker_service_zipcodes_unique 
ON worker_service_zipcodes (worker_id, zipcode, service_area_id);

-- Add audit logging trigger for ZIP code deletions
CREATE OR REPLACE FUNCTION log_zipcode_deletion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Log deletion with full context
  INSERT INTO service_area_audit_logs (
    table_name,
    operation,
    record_id,
    old_data,
    worker_id,
    change_summary
  ) VALUES (
    'worker_service_zipcodes',
    'DELETE',
    OLD.id,
    jsonb_build_object(
      'zipcode', OLD.zipcode,
      'service_area_id', OLD.service_area_id,
      'worker_id', OLD.worker_id,
      'deleted_at', now()
    ),
    OLD.worker_id,
    format('ZIP %s removed from worker %s area %s', OLD.zipcode, OLD.worker_id, OLD.service_area_id)
  );
  
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_zipcode_deletion ON worker_service_zipcodes;
CREATE TRIGGER trg_log_zipcode_deletion
BEFORE DELETE ON worker_service_zipcodes
FOR EACH ROW
EXECUTE FUNCTION log_zipcode_deletion();

-- Fix the compute_zipcodes_for_service_area function with proper worker_id scoping
CREATE OR REPLACE FUNCTION public.compute_zipcodes_for_service_area(p_service_area_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  service_area_record RECORD;
  computed_zipcodes text[];
  inserted_count integer := 0;
  deleted_count integer := 0;
BEGIN
  -- Get service area details with lock to prevent race conditions
  SELECT id, worker_id, area_name, polygon_coordinates
  INTO service_area_record
  FROM worker_service_areas
  WHERE id = p_service_area_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Service area not found: %', p_service_area_id;
  END IF;
  
  IF service_area_record.polygon_coordinates IS NULL THEN
    RAISE EXCEPTION 'Service area has no polygon coordinates';
  END IF;

  -- Compute ZIP codes using the enhanced function
  computed_zipcodes := compute_zipcodes_for_polygon(service_area_record.polygon_coordinates);
  
  -- CRITICAL FIX: Delete only ZIP codes for THIS specific service area AND worker
  -- This prevents cross-worker ZIP deletion
  DELETE FROM worker_service_zipcodes 
  WHERE service_area_id = p_service_area_id 
    AND worker_id = service_area_record.worker_id;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  -- Insert new ZIP code mappings with conflict handling
  IF computed_zipcodes IS NOT NULL AND array_length(computed_zipcodes, 1) > 0 THEN
    INSERT INTO worker_service_zipcodes (service_area_id, worker_id, zipcode)
    SELECT 
      p_service_area_id,
      service_area_record.worker_id,
      unnest(computed_zipcodes)
    ON CONFLICT (worker_id, zipcode, service_area_id) DO NOTHING;
    
    GET DIAGNOSTICS inserted_count = ROW_COUNT;
  END IF;
  
  -- Create audit log entry
  PERFORM create_service_area_audit_log(
    'worker_service_zipcodes',
    'COMPUTE',
    p_service_area_id,
    jsonb_build_object(
      'removed_count', deleted_count,
      'worker_id', service_area_record.worker_id
    ),
    jsonb_build_object(
      'added_count', inserted_count, 
      'zipcodes', computed_zipcodes,
      'worker_id', service_area_record.worker_id
    ),
    service_area_record.worker_id,
    service_area_record.area_name
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'zipcodes_added', inserted_count,
    'zipcodes_removed', deleted_count,
    'total_zipcodes', COALESCE(array_length(computed_zipcodes, 1), 0),
    'service_area_id', p_service_area_id,
    'worker_id', service_area_record.worker_id
  );
END;
$$;