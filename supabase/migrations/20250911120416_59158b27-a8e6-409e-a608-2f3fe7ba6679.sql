-- Step 1: Create ZCTA polygons table for accurate spatial queries
CREATE TABLE IF NOT EXISTS public.us_zcta_polygons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zcta5ce TEXT NOT NULL UNIQUE, -- 5-digit ZIP code
  geom GEOMETRY(MULTIPOLYGON, 4326) NOT NULL,
  land_area NUMERIC,
  water_area NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create spatial index for fast polygon intersection queries
CREATE INDEX IF NOT EXISTS idx_us_zcta_polygons_geom ON public.us_zcta_polygons USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_us_zcta_polygons_zcta5ce ON public.us_zcta_polygons (zcta5ce);

-- Step 2: Create/replace the PostGIS function for polygon intersection
CREATE OR REPLACE FUNCTION public.find_zipcodes_intersecting_polygon(polygon_coords JSONB)
RETURNS TEXT[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  polygon_geom GEOMETRY;
  zipcode_array TEXT[];
  coord_array JSONB[];
  coord JSONB;
  point_text TEXT;
BEGIN
  -- Convert JSONB array to geometry
  IF jsonb_array_length(polygon_coords) < 3 THEN
    RAISE EXCEPTION 'Polygon must have at least 3 coordinates';
  END IF;
  
  -- Build WKT POLYGON string from coordinates
  SELECT array_agg(coord_array.value) INTO coord_array FROM jsonb_array_elements(polygon_coords) AS coord_array;
  
  -- Create point strings in format "lng lat"
  point_text := '';
  FOR i IN 1..array_length(coord_array, 1) LOOP
    coord := coord_array[i];
    point_text := point_text || (coord->>'lng') || ' ' || (coord->>'lat');
    IF i < array_length(coord_array, 1) THEN
      point_text := point_text || ', ';
    END IF;
  END LOOP;
  
  -- Close the polygon by adding first point at the end if not already closed
  IF coord_array[1] != coord_array[array_length(coord_array, 1)] THEN
    coord := coord_array[1];
    point_text := point_text || ', ' || (coord->>'lng') || ' ' || (coord->>'lat');
  END IF;
  
  -- Create polygon geometry
  polygon_geom := ST_GeomFromText('POLYGON((' || point_text || '))', 4326);
  
  -- Find intersecting ZIP codes using the ZCTA polygons table
  SELECT array_agg(DISTINCT zcta5ce ORDER BY zcta5ce)
  INTO zipcode_array
  FROM public.us_zcta_polygons
  WHERE ST_Intersects(geom, polygon_geom);
  
  -- If no results from ZCTA table, return empty array (fallback will be handled in edge function)
  RETURN COALESCE(zipcode_array, ARRAY[]::TEXT[]);
  
EXCEPTION WHEN OTHERS THEN
  -- Log error and return empty array to trigger fallback
  RAISE WARNING 'PostGIS polygon intersection failed: %', SQLERRM;
  RETURN ARRAY[]::TEXT[];
END;
$$;

-- Step 3: Create spatial health check function for admin diagnostics
CREATE OR REPLACE FUNCTION public.check_spatial_health()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result JSONB := '{}'::JSONB;
  zcta_count INTEGER;
  zipcode_count INTEGER;
  postgis_version TEXT;
  sample_polygon JSONB;
  sample_result TEXT[];
BEGIN
  -- Check PostGIS version
  SELECT postgis_version() INTO postgis_version;
  result := jsonb_set(result, '{postgis_version}', to_jsonb(postgis_version));
  
  -- Check ZCTA polygons table
  SELECT count(*) INTO zcta_count FROM public.us_zcta_polygons;
  result := jsonb_set(result, '{zcta_polygons_count}', to_jsonb(zcta_count));
  
  -- Check US ZIP codes table
  SELECT count(*) INTO zipcode_count FROM public.us_zip_codes;
  result := jsonb_set(result, '{us_zip_codes_count}', to_jsonb(zipcode_count));
  
  -- Test polygon intersection with a sample Dallas area polygon
  sample_polygon := '[
    {"lat": 32.8, "lng": -96.9},
    {"lat": 32.8, "lng": -96.7},
    {"lat": 32.7, "lng": -96.7},
    {"lat": 32.7, "lng": -96.9},
    {"lat": 32.8, "lng": -96.9}
  ]'::JSONB;
  
  BEGIN
    SELECT find_zipcodes_intersecting_polygon(sample_polygon) INTO sample_result;
    result := jsonb_set(result, '{sample_test_zipcode_count}', to_jsonb(array_length(sample_result, 1)));
    result := jsonb_set(result, '{sample_test_success}', to_jsonb(true));
  EXCEPTION WHEN OTHERS THEN
    result := jsonb_set(result, '{sample_test_success}', to_jsonb(false));
    result := jsonb_set(result, '{sample_test_error}', to_jsonb(SQLERRM));
  END;
  
  -- Overall health status
  result := jsonb_set(result, '{overall_health}', 
    CASE 
      WHEN zcta_count > 30000 AND zipcode_count > 40000 AND (result->>'sample_test_success')::BOOLEAN = true 
      THEN to_jsonb('healthy'::TEXT)
      WHEN zcta_count = 0 AND zipcode_count > 40000
      THEN to_jsonb('degraded_no_polygons'::TEXT)
      ELSE to_jsonb('unhealthy'::TEXT)
    END
  );
  
  RETURN result;
END;
$$;

-- Step 4: Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.find_zipcodes_intersecting_polygon TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.check_spatial_health TO authenticated, anon;
GRANT SELECT ON public.us_zcta_polygons TO authenticated, anon;