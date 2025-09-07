-- Create RPC function to get comprehensive ZIP area information
CREATE OR REPLACE FUNCTION public.get_zip_area_info(p_zipcode text)
RETURNS TABLE(
  area_name text,
  worker_name text,
  worker_id uuid,
  has_active_worker boolean,
  zipcode text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    wsa.area_name,
    CASE 
      WHEN u.id IS NOT NULL THEN u.full_name
      ELSE NULL
    END as worker_name,
    u.id as worker_id,
    CASE 
      WHEN u.id IS NOT NULL AND u.is_active = true THEN true
      ELSE false
    END as has_active_worker,
    wsz.zipcode
  FROM worker_service_zipcodes wsz
  INNER JOIN worker_service_areas wsa ON wsz.service_area_id = wsa.id
  LEFT JOIN users u ON wsa.worker_id = u.id AND u.role = 'worker' AND u.is_active = true
  WHERE wsz.zipcode = p_zipcode
  ORDER BY 
    CASE WHEN u.is_active = true THEN 0 ELSE 1 END,
    u.full_name
  LIMIT 1;
END;
$$;