-- Fix ZIP polygon intersection system - Step 1: Create unified spatial functions

-- First, drop all the conflicting function overloads to eliminate PGRST203 errors
DROP FUNCTION IF EXISTS public.find_zipcodes_intersecting_polygon(jsonb);
DROP FUNCTION IF EXISTS public.find_zipcodes_intersecting_polygon(polygon_coords jsonb);

-- Create the canonical spatial intersection function
CREATE OR REPLACE FUNCTION public.zipcodes_intersecting_polygon_geojson(
  polygon_geojson jsonb, 
  min_overlap_percent numeric DEFAULT 0
)
RETURNS TABLE(zipcode text, boundary_geojson jsonb, overlap_percent numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  polygon_geom geometry;
  zip_record RECORD;
  intersection_geom geometry;
  zip_area numeric;
  intersection_area numeric;
  overlap_pct numeric;
BEGIN
  -- Validate input
  IF polygon_geojson IS NULL THEN
    RAISE EXCEPTION 'polygon_geojson cannot be null';
  END IF;

  -- Convert GeoJSON to PostGIS geometry
  BEGIN
    polygon_geom := ST_GeomFromGeoJSON(polygon_geojson::text);
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Invalid GeoJSON polygon: %', SQLERRM;
  END;

  -- Validate geometry
  IF NOT ST_IsValid(polygon_geom) THEN
    polygon_geom := ST_MakeValid(polygon_geom);
  END IF;

  -- Set SRID to WGS84 if not set
  IF ST_SRID(polygon_geom) = 0 THEN
    polygon_geom := ST_SetSRID(polygon_geom, 4326);
  END IF;

  -- Find intersecting ZIP codes from us_zcta_polygons (preferred) or us_zip_codes as fallback
  FOR zip_record IN
    SELECT 
      uz.zcta5ce as zipcode,
      uz.geom,
      ST_AsGeoJSON(uz.geom)::jsonb as boundary_geojson
    FROM us_zcta_polygons uz
    WHERE ST_Intersects(uz.geom, polygon_geom)
  LOOP
    -- Calculate overlap percentage if requested
    IF min_overlap_percent > 0 THEN
      intersection_geom := ST_Intersection(zip_record.geom, polygon_geom);
      zip_area := ST_Area(ST_Transform(zip_record.geom, 3857)); -- Use meters for area calculation
      intersection_area := ST_Area(ST_Transform(intersection_geom, 3857));
      
      overlap_pct := CASE 
        WHEN zip_area > 0 THEN (intersection_area / zip_area) * 100 
        ELSE 0 
      END;
      
      -- Skip if overlap is below threshold
      IF overlap_pct < min_overlap_percent THEN
        CONTINUE;
      END IF;
    ELSE
      overlap_pct := 100; -- Default to 100% if not calculating
    END IF;

    -- Return the result
    zipcode := zip_record.zipcode;
    boundary_geojson := zip_record.boundary_geojson;
    overlap_percent := overlap_pct;
    RETURN NEXT;
  END LOOP;

  -- If no results from us_zcta_polygons, fallback to us_zip_codes with point-in-polygon
  IF NOT EXISTS (SELECT 1 FROM us_zcta_polygons uz WHERE ST_Intersects(uz.geom, polygon_geom)) THEN
    FOR zip_record IN
      SELECT 
        uzc.zipcode,
        ST_MakePoint(uzc.longitude, uzc.latitude) as point_geom
      FROM us_zip_codes uzc
      WHERE uzc.longitude IS NOT NULL 
        AND uzc.latitude IS NOT NULL
        AND ST_Contains(polygon_geom, ST_SetSRID(ST_MakePoint(uzc.longitude, uzc.latitude), 4326))
    LOOP
      zipcode := zip_record.zipcode;
      boundary_geojson := NULL; -- No boundary data for point-based fallback
      overlap_percent := 100; -- Assume full coverage for point-in-polygon
      RETURN NEXT;
    END LOOP;
  END IF;

  RETURN;
END;
$$;

-- Create simple wrapper that returns just ZIP codes
CREATE OR REPLACE FUNCTION public.compute_zipcodes_for_polygon(
  polygon_geojson jsonb, 
  min_overlap_percent numeric DEFAULT 0
)
RETURNS text[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  zip_list text[];
BEGIN
  SELECT ARRAY_AGG(zipcode ORDER BY zipcode)
  INTO zip_list
  FROM public.zipcodes_intersecting_polygon_geojson(polygon_geojson, min_overlap_percent);
  
  RETURN COALESCE(zip_list, ARRAY[]::text[]);
END;
$$;

-- Create service-area-specific helper function
CREATE OR REPLACE FUNCTION public.compute_zipcodes_for_service_area(
  service_area_id uuid, 
  min_overlap_percent numeric DEFAULT 0
)
RETURNS text[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  area_record RECORD;
  polygon_geojson jsonb;
  zip_list text[];
  zip_code text;
BEGIN
  -- Get service area details
  SELECT id, worker_id, area_name, polygon_coordinates, is_active
  INTO area_record
  FROM worker_service_areas 
  WHERE id = service_area_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Service area not found: %', service_area_id;
  END IF;
  
  -- Parse polygon coordinates (handle both array format and GeoJSON)
  BEGIN
    IF jsonb_typeof(area_record.polygon_coordinates) = 'object' 
       AND area_record.polygon_coordinates ? 'type' THEN
      -- Already GeoJSON
      polygon_geojson := area_record.polygon_coordinates;
    ELSE
      -- Convert array format to GeoJSON
      polygon_geojson := jsonb_build_object(
        'type', 'Polygon',
        'coordinates', jsonb_build_array(
          area_record.polygon_coordinates || jsonb_build_array(area_record.polygon_coordinates->0)
        )
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Invalid polygon coordinates for service area %: %', service_area_id, SQLERRM;
  END;
  
  -- Get ZIP codes using canonical function
  zip_list := public.compute_zipcodes_for_polygon(polygon_geojson, min_overlap_percent);
  
  -- Clear existing ZIP codes for this service area
  DELETE FROM worker_service_zipcodes WHERE service_area_id = service_area_id;
  
  -- Insert new ZIP codes
  FOR zip_code IN SELECT unnest(zip_list)
  LOOP
    INSERT INTO worker_service_zipcodes (worker_id, service_area_id, zipcode)
    VALUES (area_record.worker_id, service_area_id, zip_code)
    ON CONFLICT (worker_id, service_area_id, zipcode) DO NOTHING;
  END LOOP;
  
  -- Log the operation
  INSERT INTO service_area_audit_logs (
    worker_id, record_id, table_name, operation, area_name, change_summary, new_data
  ) VALUES (
    area_record.worker_id, 
    service_area_id, 
    'worker_service_areas', 
    'compute_zipcodes', 
    area_record.area_name,
    format('Computed %s ZIP codes with %s%% minimum overlap', array_length(zip_list, 1), min_overlap_percent),
    jsonb_build_object('zipcode_count', array_length(zip_list, 1), 'zipcodes', to_jsonb(zip_list))
  );
  
  RETURN zip_list;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.zipcodes_intersecting_polygon_geojson(jsonb, numeric) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.compute_zipcodes_for_polygon(jsonb, numeric) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.compute_zipcodes_for_service_area(uuid, numeric) TO authenticated, anon;

-- Ensure proper indexes exist
CREATE INDEX IF NOT EXISTS idx_us_zcta_polygons_geom_gist ON public.us_zcta_polygons USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_us_zip_codes_coords ON public.us_zip_codes (longitude, latitude) WHERE longitude IS NOT NULL AND latitude IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_worker_service_zipcodes_area_id ON public.worker_service_zipcodes (service_area_id);

-- Update the spatial health check function to use new functions
CREATE OR REPLACE FUNCTION public.check_spatial_health()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb := '{}'::jsonb;
  postgis_version text;
  zcta_count integer;
  zip_count integer;
  sample_result text[];
  sample_polygon jsonb;
BEGIN
  -- Check PostGIS version
  BEGIN
    SELECT postgis_version() INTO postgis_version;
    result := jsonb_set(result, '{postgis_version}', to_jsonb(postgis_version));
  EXCEPTION WHEN OTHERS THEN
    result := jsonb_set(result, '{postgis_version}', '"Error: PostGIS not available"');
  END;
  
  -- Check us_zcta_polygons count
  BEGIN
    SELECT COUNT(*) INTO zcta_count FROM us_zcta_polygons;
    result := jsonb_set(result, '{zcta_polygon_count}', to_jsonb(zcta_count));
    result := jsonb_set(result, '{zcta_adequate}', to_jsonb(zcta_count > 30000));
  EXCEPTION WHEN OTHERS THEN
    result := jsonb_set(result, '{zcta_polygon_count}', to_jsonb(0));
    result := jsonb_set(result, '{zcta_adequate}', to_jsonb(false));
  END;
  
  -- Check us_zip_codes count
  BEGIN
    SELECT COUNT(*) INTO zip_count FROM us_zip_codes;
    result := jsonb_set(result, '{zip_code_count}', to_jsonb(zip_count));
    result := jsonb_set(result, '{zip_adequate}', to_jsonb(zip_count > 40000));
  EXCEPTION WHEN OTHERS THEN
    result := jsonb_set(result, '{zip_code_count}', to_jsonb(0));
    result := jsonb_set(result, '{zip_adequate}', to_jsonb(false));
  END;
  
  -- Test sample polygon intersection (Dallas area)
  sample_polygon := '{
    "type": "Polygon",
    "coordinates": [[
      [-96.85, 32.75], [-96.75, 32.75], [-96.75, 32.85], [-96.85, 32.85], [-96.85, 32.75]
    ]]
  }'::jsonb;
  
  BEGIN
    SELECT compute_zipcodes_for_polygon(sample_polygon, 0) INTO sample_result;
    result := jsonb_set(result, '{sample_test_zipcode_count}', to_jsonb(array_length(sample_result, 1)));
    result := jsonb_set(result, '{sample_test_success}', to_jsonb(true));
    result := jsonb_set(result, '{sample_zipcodes}', to_jsonb(sample_result));
  EXCEPTION WHEN OTHERS THEN
    result := jsonb_set(result, '{sample_test_success}', to_jsonb(false));
    result := jsonb_set(result, '{sample_test_error}', to_jsonb(SQLERRM));
  END;
  
  -- Add health recommendations
  result := jsonb_set(result, '{overall_health}', 
    CASE 
      WHEN zcta_count > 30000 AND zip_count > 40000 AND array_length(sample_result, 1) > 0 THEN '"healthy"'
      WHEN zcta_count = 0 AND zip_count = 0 THEN '"critical"'
      ELSE '"degraded"'
    END
  );
  
  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_spatial_health() TO authenticated, anon;