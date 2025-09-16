-- Enhanced spatial functions for polygon drawing and ZIP code mapping

-- Improved function to compute ZIP codes for a polygon with better error handling
CREATE OR REPLACE FUNCTION public.compute_zipcodes_for_polygon(p_polygon_coords jsonb)
RETURNS text[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  polygon_geom geometry;
  zipcodes text[];
BEGIN
  -- Convert polygon coordinates to PostGIS geometry
  BEGIN
    polygon_geom := ST_GeomFromGeoJSON(p_polygon_coords::text);
    
    -- Ensure proper SRID (WGS84)
    polygon_geom := ST_SetSRID(polygon_geom, 4326);
    
    -- Validate geometry
    IF NOT ST_IsValid(polygon_geom) THEN
      RAISE EXCEPTION 'Invalid polygon geometry provided';
    END IF;
    
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Failed to parse polygon coordinates: %', SQLERRM;
  END;

  -- First try with ZCTA polygons (primary source)
  BEGIN
    SELECT ARRAY_AGG(DISTINCT zcta5ce ORDER BY zcta5ce)
    INTO zipcodes
    FROM us_zcta_polygons
    WHERE ST_Intersects(geom, polygon_geom);
    
    -- If we got results, return them
    IF zipcodes IS NOT NULL AND array_length(zipcodes, 1) > 0 THEN
      RETURN zipcodes;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Log error but continue to fallback
    RAISE WARNING 'ZCTA polygon query failed: %', SQLERRM;
  END;

  -- Fallback to comprehensive ZIP code data with centroid check
  BEGIN
    SELECT ARRAY_AGG(DISTINCT zipcode ORDER BY zipcode)
    INTO zipcodes
    FROM comprehensive_zip_codes
    WHERE ST_Contains(
      polygon_geom,
      ST_Point(longitude, latitude)
    );
    
    IF zipcodes IS NOT NULL AND array_length(zipcodes, 1) > 0 THEN
      RETURN zipcodes;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Comprehensive ZIP lookup failed: %', SQLERRM;
  END;

  -- Return empty array if no matches found
  RETURN ARRAY[]::text[];
END;
$$;

-- Enhanced function to compute ZIP codes for a service area with audit logging
CREATE OR REPLACE FUNCTION public.compute_zipcodes_for_service_area(p_service_area_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  service_area_record RECORD;
  computed_zipcodes text[];
  inserted_count integer := 0;
  updated_count integer := 0;
BEGIN
  -- Get service area details
  SELECT id, worker_id, area_name, polygon_coordinates
  INTO service_area_record
  FROM worker_service_areas
  WHERE id = p_service_area_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Service area not found: %', p_service_area_id;
  END IF;
  
  IF service_area_record.polygon_coordinates IS NULL THEN
    RAISE EXCEPTION 'Service area has no polygon coordinates';
  END IF;

  -- Compute ZIP codes using the enhanced function
  computed_zipcodes := compute_zipcodes_for_polygon(service_area_record.polygon_coordinates);
  
  -- Clear existing ZIP code mappings for this service area
  DELETE FROM worker_service_zipcodes 
  WHERE service_area_id = p_service_area_id;
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  
  -- Insert new ZIP code mappings
  IF computed_zipcodes IS NOT NULL AND array_length(computed_zipcodes, 1) > 0 THEN
    INSERT INTO worker_service_zipcodes (service_area_id, worker_id, zipcode)
    SELECT 
      p_service_area_id,
      service_area_record.worker_id,
      unnest(computed_zipcodes);
    
    GET DIAGNOSTICS inserted_count = ROW_COUNT;
  END IF;
  
  -- Create audit log entry
  PERFORM create_service_area_audit_log(
    'worker_service_zipcodes',
    'COMPUTE',
    p_service_area_id,
    jsonb_build_object('removed_count', updated_count),
    jsonb_build_object('added_count', inserted_count, 'zipcodes', computed_zipcodes),
    service_area_record.worker_id,
    service_area_record.area_name
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'zipcodes_added', inserted_count,
    'zipcodes_removed', updated_count,
    'total_zipcodes', array_length(computed_zipcodes, 1),
    'service_area_id', p_service_area_id
  );
END;
$$;

-- Function to get ZIP codes that intersect with a polygon (fallback method)
CREATE OR REPLACE FUNCTION public.zipcodes_intersecting_polygon(polygon_coords jsonb)
RETURNS text[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  polygon_geom geometry;
  zipcodes text[];
BEGIN
  -- Use the primary function first
  zipcodes := compute_zipcodes_for_polygon(polygon_coords);
  
  -- If primary function succeeded, return results
  IF zipcodes IS NOT NULL AND array_length(zipcodes, 1) > 0 THEN
    RETURN zipcodes;
  END IF;
  
  -- Additional fallback using bounding box intersection
  BEGIN
    polygon_geom := ST_GeomFromGeoJSON(polygon_coords::text);
    polygon_geom := ST_SetSRID(polygon_geom, 4326);
    
    -- Get ZIP codes whose center points are within expanded bounding box
    SELECT ARRAY_AGG(DISTINCT zipcode ORDER BY zipcode)
    INTO zipcodes
    FROM comprehensive_zip_codes
    WHERE ST_DWithin(
      ST_Point(longitude, latitude),
      polygon_geom,
      0.1 -- ~11km tolerance
    );
    
    RETURN COALESCE(zipcodes, ARRAY[]::text[]);
    
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Bounding box fallback failed: %', SQLERRM;
    RETURN ARRAY[]::text[];
  END;
END;
$$;

-- Function to validate polygon coverage and provide recommendations
CREATE OR REPLACE FUNCTION public.validate_polygon_coverage(polygon_coords jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  polygon_geom geometry;
  area_km2 numeric;
  zipcode_count integer;
  recommendations text[] := ARRAY[]::text[];
  warnings text[] := ARRAY[]::text[];
BEGIN
  -- Parse and validate polygon
  BEGIN
    polygon_geom := ST_GeomFromGeoJSON(polygon_coords::text);
    polygon_geom := ST_SetSRID(polygon_geom, 4326);
    
    IF NOT ST_IsValid(polygon_geom) THEN
      warnings := warnings || 'Polygon geometry is invalid';
    END IF;
    
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error', 'Failed to parse polygon geometry'
    );
  END;

  -- Calculate area (approximate)
  area_km2 := ST_Area(ST_Transform(polygon_geom, 3857)) / 1000000; -- Convert to km²
  
  -- Count ZIP codes
  SELECT COUNT(DISTINCT zipcode)
  INTO zipcode_count
  FROM (
    SELECT unnest(compute_zipcodes_for_polygon(polygon_coords)) AS zipcode
  ) AS zips;
  
  -- Generate recommendations
  IF area_km2 > 10000 THEN
    recommendations := recommendations || 'Consider splitting large area into smaller regions';
  END IF;
  
  IF area_km2 < 1 THEN
    recommendations := recommendations || 'Small area may have limited service coverage';
  END IF;
  
  IF zipcode_count = 0 THEN
    warnings := warnings || 'No ZIP codes found - check polygon placement';
    recommendations := recommendations || 'Ensure polygon covers populated areas';
  ELSIF zipcode_count > 100 THEN
    recommendations := recommendations || 'Large coverage area - consider performance optimization';
  END IF;
  
  RETURN jsonb_build_object(
    'valid', true,
    'area_km2', ROUND(area_km2::numeric, 2),
    'zipcode_count', zipcode_count,
    'warnings', warnings,
    'recommendations', recommendations
  );
END;
$$;