-- Add the missing function for auto-assignment
CREATE OR REPLACE FUNCTION public.get_workers_for_zipcode(p_zipcode text)
RETURNS TABLE(worker_id uuid, worker_name text, worker_email text)
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT u.id, u.name, u.email
  FROM worker_service_zipcodes wsz
  JOIN users u ON u.id = wsz.worker_id
  WHERE wsz.zipcode = p_zipcode
    AND u.role = 'worker'::user_role
    AND u.is_active IS TRUE
  ORDER BY u.name;
$$;