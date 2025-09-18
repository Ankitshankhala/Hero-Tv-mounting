-- Consolidate and optimize ZIP code data structure
-- This migration implements the performance fix plan

-- 1. Create optimized spatial indexes on comprehensive tables
CREATE INDEX IF NOT EXISTS idx_comprehensive_zip_codes_zipcode ON comprehensive_zip_codes(zipcode);
CREATE INDEX IF NOT EXISTS idx_comprehensive_zip_codes_state_city ON comprehensive_zip_codes(state_abbr, city);
CREATE INDEX IF NOT EXISTS idx_comprehensive_zip_codes_coordinates ON comprehensive_zip_codes(latitude, longitude) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- Create spatial index on ZCTA polygons
CREATE INDEX IF NOT EXISTS idx_comprehensive_zcta_polygons_geom ON comprehensive_zcta_polygons USING GIST(geom);
CREATE INDEX IF NOT EXISTS idx_comprehensive_zcta_polygons_zcta5ce ON comprehensive_zcta_polygons(zcta5ce);

-- 2. Create optimized service coverage lookup function using comprehensive tables
CREATE OR REPLACE FUNCTION get_comprehensive_zip_coverage(p_zipcode text)
RETURNS TABLE(
  has_coverage boolean,
  worker_count integer,
  city text,
  state text,
  state_abbr text,
  latitude numeric,
  longitude numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  zip_data RECORD;
  coverage_count INTEGER := 0;
BEGIN
  -- Clean input zipcode
  p_zipcode := REGEXP_REPLACE(p_zipcode, '[^0-9]', '', 'g');
  p_zipcode := SUBSTRING(p_zipcode, 1, 5);
  
  -- Validate input
  IF LENGTH(p_zipcode) != 5 THEN
    RETURN QUERY SELECT false, 0, ''::text, ''::text, ''::text, NULL::numeric, NULL::numeric;
    RETURN;
  END IF;
  
  -- Get ZIP code data from comprehensive table
  SELECT INTO zip_data
    czc.city,
    czc.state,
    czc.state_abbr,
    czc.latitude,
    czc.longitude
  FROM comprehensive_zip_codes czc
  WHERE czc.zipcode = p_zipcode
  LIMIT 1;
  
  -- Count workers serving this ZIP code
  SELECT COUNT(DISTINCT wsa.worker_id) INTO coverage_count
  FROM worker_service_zipcodes wsz
  INNER JOIN worker_service_areas wsa ON wsz.service_area_id = wsa.id
  INNER JOIN users u ON wsa.worker_id = u.id
  WHERE wsz.zipcode = p_zipcode 
    AND wsa.is_active = true
    AND u.is_active = true
    AND u.role = 'worker';
  
  -- Return results with fallback for missing ZIP data
  RETURN QUERY SELECT 
    COALESCE(coverage_count > 0, false),
    COALESCE(coverage_count, 0),
    COALESCE(zip_data.city, 'Unknown'),
    COALESCE(zip_data.state, 'Unknown'),
    COALESCE(zip_data.state_abbr, 'US'),
    zip_data.latitude,
    zip_data.longitude;
END;
$$;

-- 3. Create batch ZIP coordinate lookup function
CREATE OR REPLACE FUNCTION get_batch_zip_coordinates(p_zipcodes text[])
RETURNS TABLE(
  zipcode text,
  latitude numeric,
  longitude numeric,
  city text,
  state_abbr text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Clean and validate input zipcodes
  RETURN QUERY
  SELECT 
    czc.zipcode,
    czc.latitude,
    czc.longitude,
    czc.city,
    czc.state_abbr
  FROM comprehensive_zip_codes czc
  WHERE czc.zipcode = ANY(
    SELECT REGEXP_REPLACE(unnest(p_zipcodes), '[^0-9]', '', 'g')
  )
  AND czc.latitude IS NOT NULL 
  AND czc.longitude IS NOT NULL;
END;
$$;

-- 4. Create ZCTA boundary lookup function using comprehensive polygons
CREATE OR REPLACE FUNCTION get_zcta_boundary(p_zipcode text)
RETURNS TABLE(
  zcta5ce text,
  boundary_geojson jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  clean_zipcode text;
BEGIN
  -- Clean input zipcode
  clean_zipcode := REGEXP_REPLACE(p_zipcode, '[^0-9]', '', 'g');
  clean_zipcode := SUBSTRING(clean_zipcode, 1, 5);
  
  -- Return ZCTA boundary as GeoJSON
  RETURN QUERY
  SELECT 
    czp.zcta5ce,
    ST_AsGeoJSON(czp.geom)::jsonb as boundary_geojson
  FROM comprehensive_zcta_polygons czp
  WHERE czp.zcta5ce = clean_zipcode
  LIMIT 1;
END;
$$;

-- 5. Create worker ZIP code batch loading function
CREATE OR REPLACE FUNCTION get_worker_zip_coordinates_batch(p_worker_id uuid)
RETURNS TABLE(
  zipcode text,
  latitude numeric,
  longitude numeric,
  city text,
  state_abbr text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Get all ZIP coordinates for a worker's service areas efficiently
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

-- 6. Create spatial intersection function for service areas
CREATE OR REPLACE FUNCTION find_zipcodes_in_service_area(
  p_polygon_coords jsonb,
  p_include_boundaries boolean DEFAULT false
)
RETURNS TABLE(
  zipcode text,
  boundary_geojson jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  service_polygon geometry;
  coord_array jsonb;
  coord_pair jsonb;
  point_text text := '';
BEGIN
  -- Build polygon from coordinates
  FOR coord_array IN SELECT jsonb_array_elements(p_polygon_coords)
  LOOP
    FOR coord_pair IN SELECT jsonb_array_elements(coord_array)
    LOOP
      IF point_text != '' THEN
        point_text := point_text || ', ';
      END IF;
      point_text := point_text || (coord_pair->>0) || ' ' || (coord_pair->>1);
    END LOOP;
  END LOOP;
  
  -- Create polygon geometry
  service_polygon := ST_GeomFromText('POLYGON((' || point_text || '))', 4326);
  
  -- Find intersecting ZCTA polygons and return ZIP codes
  IF p_include_boundaries THEN
    RETURN QUERY
    SELECT 
      czp.zcta5ce as zipcode,
      ST_AsGeoJSON(czp.geom)::jsonb as boundary_geojson
    FROM comprehensive_zcta_polygons czp
    WHERE ST_Intersects(czp.geom, service_polygon)
    ORDER BY czp.zcta5ce;
  ELSE
    RETURN QUERY
    SELECT 
      czp.zcta5ce as zipcode,
      NULL::jsonb as boundary_geojson
    FROM comprehensive_zcta_polygons czp
    WHERE ST_Intersects(czp.geom, service_polygon)
    ORDER BY czp.zcta5ce;
  END IF;
  
EXCEPTION WHEN OTHERS THEN
  -- Fallback to coordinate-based lookup if ZCTA data unavailable
  RETURN QUERY
  SELECT DISTINCT
    czc.zipcode,
    NULL::jsonb as boundary_geojson
  FROM comprehensive_zip_codes czc
  WHERE czc.latitude IS NOT NULL 
    AND czc.longitude IS NOT NULL
    AND ST_Contains(
      service_polygon,
      ST_Point(czc.longitude, czc.latitude)
    )
  ORDER BY czc.zipcode;
END;
$$;

-- 7. Create performance monitoring function
CREATE OR REPLACE FUNCTION check_zip_data_health()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb := '{}'::jsonb;
  zip_count integer;
  zcta_count integer;
  missing_coords integer;
  coverage_count integer;
BEGIN
  -- Count comprehensive ZIP codes
  SELECT COUNT(*) INTO zip_count FROM comprehensive_zip_codes;
  result := jsonb_set(result, '{comprehensive_zip_codes}', zip_count::text::jsonb);
  
  -- Count ZCTA polygons
  SELECT COUNT(*) INTO zcta_count FROM comprehensive_zcta_polygons;
  result := jsonb_set(result, '{comprehensive_zcta_polygons}', zcta_count::text::jsonb);
  
  -- Count ZIPs missing coordinates
  SELECT COUNT(*) INTO missing_coords 
  FROM comprehensive_zip_codes 
  WHERE latitude IS NULL OR longitude IS NULL;
  result := jsonb_set(result, '{missing_coordinates}', missing_coords::text::jsonb);
  
  -- Count ZIP codes with active coverage
  SELECT COUNT(DISTINCT wsz.zipcode) INTO coverage_count
  FROM worker_service_zipcodes wsz
  INNER JOIN worker_service_areas wsa ON wsz.service_area_id = wsa.id
  INNER JOIN users u ON wsa.worker_id = u.id
  WHERE wsa.is_active = true AND u.is_active = true AND u.role = 'worker';
  result := jsonb_set(result, '{zips_with_coverage}', coverage_count::text::jsonb);
  
  -- Overall health assessment
  IF zip_count > 40000 AND zcta_count > 30000 AND missing_coords < 1000 THEN
    result := jsonb_set(result, '{health_status}', '"excellent"'::jsonb);
  ELSIF zip_count > 10000 AND missing_coords < (zip_count * 0.1) THEN
    result := jsonb_set(result, '{health_status}', '"good"'::jsonb);
  ELSIF zip_count > 1000 THEN
    result := jsonb_set(result, '{health_status}', '"fair"'::jsonb);
  ELSE
    result := jsonb_set(result, '{health_status}', '"critical"'::jsonb);
  END IF;
  
  RETURN result;
END;
$$;