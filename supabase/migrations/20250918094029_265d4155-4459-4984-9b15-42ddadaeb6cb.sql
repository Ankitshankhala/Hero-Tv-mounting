-- Create missing comprehensive ZIP code functions

-- Function to get worker ZIP coordinates using comprehensive data
CREATE OR REPLACE FUNCTION get_comprehensive_worker_zip_coordinates(p_worker_id uuid)
RETURNS TABLE(
  zipcode text,
  latitude numeric,
  longitude numeric,
  city text,
  state_abbr text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT
    czc.zipcode,
    czc.latitude,
    czc.longitude,
    czc.city,
    czc.state_abbr
  FROM worker_service_zipcodes wsz
  INNER JOIN worker_service_areas wsa ON wsz.service_area_id = wsa.id
  INNER JOIN comprehensive_zip_codes czc ON wsz.zipcode = czc.zipcode
  WHERE wsa.worker_id = p_worker_id
    AND wsa.is_active = true
    AND czc.latitude IS NOT NULL
    AND czc.longitude IS NOT NULL
  ORDER BY czc.zipcode;
END;
$$;

-- Function to get comprehensive batch ZIP coordinates
CREATE OR REPLACE FUNCTION get_comprehensive_batch_zip_coordinates(p_zipcodes text[])
RETURNS TABLE(
  zipcode text,
  latitude numeric,
  longitude numeric,
  city text,
  state_abbr text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    czc.zipcode,
    czc.latitude,
    czc.longitude,
    czc.city,
    czc.state_abbr
  FROM comprehensive_zip_codes czc
  WHERE czc.zipcode = ANY(p_zipcodes)
    AND czc.latitude IS NOT NULL
    AND czc.longitude IS NOT NULL
  ORDER BY czc.zipcode;
END;
$$;

-- Function to get comprehensive ZCTA boundary
CREATE OR REPLACE FUNCTION get_comprehensive_zcta_boundary(p_zcta_code text)
RETURNS TABLE(
  zcta5ce text,
  geom_geojson jsonb,
  land_area numeric,
  water_area numeric,
  data_source text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    czp.zcta5ce,
    ST_AsGeoJSON(czp.geom)::jsonb as geom_geojson,
    czp.land_area,
    czp.water_area,
    czp.data_source
  FROM comprehensive_zcta_polygons czp
  WHERE czp.zcta5ce = p_zcta_code
  LIMIT 1;
END;
$$;