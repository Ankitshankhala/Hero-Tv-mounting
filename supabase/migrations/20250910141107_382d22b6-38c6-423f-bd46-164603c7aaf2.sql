-- Create function to merge multiple service areas for a worker into one consolidated area
CREATE OR REPLACE FUNCTION public.merge_worker_service_areas(p_worker_id uuid, p_new_area_name text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  merged_zipcodes TEXT[];
  new_area_id UUID;
  result jsonb;
BEGIN
  -- Get all unique zipcodes across all active service areas for this worker
  SELECT ARRAY_AGG(DISTINCT wsz.zipcode ORDER BY wsz.zipcode)
  INTO merged_zipcodes
  FROM worker_service_zipcodes wsz
  INNER JOIN worker_service_areas wsa ON wsz.service_area_id = wsa.id
  WHERE wsz.worker_id = p_worker_id
    AND wsa.is_active = true;
    
  -- If no zipcodes found, return error
  IF merged_zipcodes IS NULL OR array_length(merged_zipcodes, 1) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'No active service areas found for worker');
  END IF;
  
  -- Create new consolidated service area
  INSERT INTO worker_service_areas (worker_id, area_name, is_active)
  VALUES (p_worker_id, p_new_area_name, true)
  RETURNING id INTO new_area_id;
  
  -- Insert all unique zipcodes into the new area
  INSERT INTO worker_service_zipcodes (worker_id, service_area_id, zipcode)
  SELECT p_worker_id, new_area_id, unnest(merged_zipcodes);
  
  -- Deactivate old service areas (don't delete to preserve audit trail)
  UPDATE worker_service_areas 
  SET is_active = false, updated_at = now()
  WHERE worker_id = p_worker_id 
    AND id != new_area_id
    AND is_active = true;
  
  -- Create audit log
  PERFORM create_service_area_audit_log(
    p_worker_id,
    new_area_id,
    'merge_areas',
    'worker_service_areas',
    jsonb_build_object(
      'merged_zipcode_count', array_length(merged_zipcodes, 1),
      'new_area_name', p_new_area_name
    ),
    null,
    p_worker_id
  );
  
  result := jsonb_build_object(
    'success', true,
    'message', 'Successfully merged ' || array_length(merged_zipcodes, 1) || ' unique ZIP codes into consolidated area',
    'new_area_id', new_area_id,
    'zipcode_count', array_length(merged_zipcodes, 1)
  );
  
  RETURN result;
END;
$function$;

-- Create function to get worker stats with total zipcode count
CREATE OR REPLACE FUNCTION public.get_worker_zipcode_stats(p_worker_id uuid)
RETURNS TABLE(
  worker_id uuid,
  total_zipcodes integer,
  active_areas integer,
  inactive_areas integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    p_worker_id,
    COUNT(DISTINCT wsz.zipcode)::integer as total_zipcodes,
    COUNT(DISTINCT CASE WHEN wsa.is_active = true THEN wsa.id END)::integer as active_areas,
    COUNT(DISTINCT CASE WHEN wsa.is_active = false THEN wsa.id END)::integer as inactive_areas
  FROM worker_service_areas wsa
  LEFT JOIN worker_service_zipcodes wsz ON wsz.service_area_id = wsa.id
  WHERE wsa.worker_id = p_worker_id;
END;
$function$;