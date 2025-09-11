-- Create audit log function for service area operations
CREATE OR REPLACE FUNCTION public.create_service_area_audit_log(
  p_worker_id uuid,
  p_record_id uuid,
  p_operation text,
  p_table_name text,
  p_new_data jsonb DEFAULT NULL,
  p_old_data jsonb DEFAULT NULL,
  p_changed_by uuid DEFAULT NULL,
  p_area_name text DEFAULT NULL,
  p_change_summary text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  audit_id uuid;
BEGIN
  INSERT INTO public.service_area_audit_logs (
    worker_id,
    record_id,
    operation,
    table_name,
    new_data,
    old_data,
    changed_by,
    area_name,
    change_summary
  ) VALUES (
    p_worker_id,
    p_record_id,
    p_operation,
    p_table_name,
    p_new_data,
    p_old_data,
    COALESCE(p_changed_by, auth.uid()),
    p_area_name,
    p_change_summary
  ) RETURNING id INTO audit_id;
  
  RETURN audit_id;
END;
$function$;

-- Create function to get worker zipcode stats (only active areas)
CREATE OR REPLACE FUNCTION public.get_worker_zipcode_stats(p_worker_id uuid)
RETURNS TABLE(
  total_zipcodes bigint,
  active_areas_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(DISTINCT wsz.zipcode) as total_zipcodes,
    COUNT(DISTINCT wsa.id) as active_areas_count
  FROM worker_service_areas wsa
  LEFT JOIN worker_service_zipcodes wsz ON wsa.id = wsz.service_area_id
  WHERE wsa.worker_id = p_worker_id 
    AND wsa.is_active = true;
END;
$function$;