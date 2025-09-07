-- Drop existing function first to change return type
DROP FUNCTION IF EXISTS public.get_zipcode_location_data(text);

-- Create US ZIP codes table for accurate city/state lookup
CREATE TABLE IF NOT EXISTS public.us_zip_codes (
  zipcode TEXT PRIMARY KEY,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  state_abbr TEXT NOT NULL,
  latitude NUMERIC,
  longitude NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Insert sample ZIP codes (Fort Worth and Dallas area)
INSERT INTO public.us_zip_codes (zipcode, city, state, state_abbr, latitude, longitude) VALUES
('76101', 'Fort Worth', 'Texas', 'TX', 32.7555, -97.3308),
('76102', 'Fort Worth', 'Texas', 'TX', 32.7357, -97.3364),
('75019', 'Coppell', 'Texas', 'TX', 32.9546, -97.0150),
('75201', 'Dallas', 'Texas', 'TX', 32.7767, -96.7970),
('75202', 'Dallas', 'Texas', 'TX', 32.7767, -96.7970)
ON CONFLICT (zipcode) DO NOTHING;

-- Create updated get_zipcode_location_data function
CREATE OR REPLACE FUNCTION public.get_zipcode_location_data(p_zipcode text)
RETURNS TABLE(city text, state text, state_abbr text, latitude numeric, longitude numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    z.city,
    z.state, 
    z.state_abbr,
    z.latitude,
    z.longitude
  FROM public.us_zip_codes z
  WHERE z.zipcode = p_zipcode;
END;
$function$;

-- Function to check if ZIP has active worker coverage
CREATE OR REPLACE FUNCTION public.zip_has_active_coverage_by_zip(p_zipcode text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM public.worker_service_zipcodes wsz
    INNER JOIN public.worker_service_areas wsa ON wsz.service_area_id = wsa.id
    INNER JOIN public.users u ON wsz.worker_id = u.id
    WHERE wsz.zipcode = p_zipcode
      AND wsa.is_active = true
      AND u.role = 'worker'
      AND u.is_active = true
  );
END;
$function$;

-- Function to get worker count by ZIP code
CREATE OR REPLACE FUNCTION public.get_worker_count_by_zip(p_zipcode text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  worker_count integer;
BEGIN
  SELECT COUNT(DISTINCT wsz.worker_id)
  INTO worker_count
  FROM public.worker_service_zipcodes wsz
  INNER JOIN public.worker_service_areas wsa ON wsz.service_area_id = wsa.id
  INNER JOIN public.users u ON wsz.worker_id = u.id
  WHERE wsz.zipcode = p_zipcode
    AND wsa.is_active = true
    AND u.role = 'worker'
    AND u.is_active = true;
    
  RETURN COALESCE(worker_count, 0);
END;
$function$;