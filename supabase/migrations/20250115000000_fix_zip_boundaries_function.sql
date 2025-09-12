-- Fix get_nearby_zip_boundaries function to use correct table
CREATE OR REPLACE FUNCTION public.get_nearby_zip_boundaries(
  center_lat numeric,
  center_lng numeric,
  radius_km numeric DEFAULT 50
)
RETURNS TABLE(zipcode text, boundary_geojson jsonb, distance_km numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  center_point geometry;
BEGIN
  -- Create center point
  center_point := ST_SetSRID(ST_MakePoint(center_lng, center_lat), 4326);
  
  RETURN QUERY
  SELECT 
    zp.zipcode::text,
    ST_AsGeoJSON(zp.geom)::jsonb,
    ROUND((ST_Distance(ST_Transform(center_point, 3857), ST_Transform(ST_Centroid(zp.geom), 3857)) / 1000)::numeric, 2)
  FROM public.zip_polygons zp
  WHERE ST_DWithin(
    ST_Transform(center_point, 3857), 
    ST_Transform(ST_Centroid(zp.geom), 3857), 
    radius_km * 1000
  )
  ORDER BY ST_Distance(ST_Transform(center_point, 3857), ST_Transform(ST_Centroid(zp.geom), 3857))
  LIMIT 100;
END;
$$;
