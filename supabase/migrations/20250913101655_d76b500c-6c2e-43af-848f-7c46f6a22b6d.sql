-- Create unified spatial function for consistent ZIP code lookup
CREATE OR REPLACE FUNCTION public.find_zipcodes_in_polygon_geojson(
  polygon_geojson jsonb,
  min_overlap_percent numeric DEFAULT 0.1
) 
RETURNS TABLE (zipcode text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  polygon_geometry geometry;
  zipcode_count integer := 0;
BEGIN
  -- Convert GeoJSON to PostGIS geometry
  BEGIN
    polygon_geometry := ST_GeomFromGeoJSON(polygon_geojson::text);
    
    -- Ensure valid geometry
    IF NOT ST_IsValid(polygon_geometry) THEN
      polygon_geometry := ST_MakeValid(polygon_geometry);
    END IF;
    
    -- Transform to appropriate projection for area calculations if needed
    IF ST_SRID(polygon_geometry) = 4326 THEN
      -- Transform to Web Mercator for more accurate area calculations
      polygon_geometry := ST_Transform(polygon_geometry, 3857);
    END IF;
    
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Invalid GeoJSON polygon: %', SQLERRM;
  END;
  
  -- Log the polygon processing
  GET DIAGNOSTICS zipcode_count = ROW_COUNT;
  RAISE NOTICE 'Processing polygon with SRID: %, area: % sq meters', 
    ST_SRID(polygon_geometry), 
    ST_Area(polygon_geometry);
  
  -- Find ZIP codes using spatial intersection with the ZCTA polygons
  RETURN QUERY
  SELECT DISTINCT uz.zcta5ce as zipcode
  FROM us_zcta_polygons uz
  WHERE ST_Intersects(
    CASE 
      WHEN ST_SRID(uz.geom) = ST_SRID(polygon_geometry) THEN uz.geom
      ELSE ST_Transform(uz.geom, ST_SRID(polygon_geometry))
    END,
    polygon_geometry
  )
  AND (
    min_overlap_percent = 0 OR
    ST_Area(ST_Intersection(
      CASE 
        WHEN ST_SRID(uz.geom) = ST_SRID(polygon_geometry) THEN uz.geom
        ELSE ST_Transform(uz.geom, ST_SRID(polygon_geometry))
      END,
      polygon_geometry
    )) / ST_Area(
      CASE 
        WHEN ST_SRID(uz.geom) = ST_SRID(polygon_geometry) THEN uz.geom
        ELSE ST_Transform(uz.geom, ST_SRID(polygon_geometry))
      END
    ) >= min_overlap_percent / 100.0
  )
  ORDER BY uz.zcta5ce;
  
  -- Log results
  GET DIAGNOSTICS zipcode_count = ROW_COUNT;
  RAISE NOTICE 'Found % ZIP codes intersecting polygon', zipcode_count;
  
  RETURN;
END;
$$;

-- Create helper function for service area ZIP computation and upserting
CREATE OR REPLACE FUNCTION public.compute_and_upsert_service_area_zips(
  p_worker_id uuid,
  p_area_id uuid,
  p_polygon_geojson jsonb,
  p_min_overlap_percent numeric DEFAULT 0.1
)
RETURNS TABLE (
  zipcode text,
  operation text,
  success boolean,
  error_message text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  zip_record record;
  operation_result text;
  operation_success boolean;
  error_msg text;
BEGIN
  -- Validate inputs
  IF p_worker_id IS NULL OR p_area_id IS NULL THEN
    RAISE EXCEPTION 'Worker ID and Area ID are required';
  END IF;
  
  IF p_polygon_geojson IS NULL THEN
    RAISE EXCEPTION 'Polygon GeoJSON is required';
  END IF;
  
  RAISE NOTICE 'Computing ZIP codes for worker % area %', p_worker_id, p_area_id;
  
  -- Find ZIP codes intersecting the polygon
  FOR zip_record IN 
    SELECT fz.zipcode 
    FROM public.find_zipcodes_in_polygon_geojson(p_polygon_geojson, p_min_overlap_percent) fz
  LOOP
    BEGIN
      operation_result := 'unknown';
      operation_success := false;
      error_msg := NULL;
      
      -- Try to insert new ZIP code mapping
      INSERT INTO worker_service_zipcodes (
        worker_id, 
        zipcode, 
        service_area_id,
        from_polygon,
        from_manual
      ) VALUES (
        p_worker_id,
        zip_record.zipcode,
        p_area_id,
        true,
        false
      );
      
      operation_result := 'inserted';
      operation_success := true;
      
    EXCEPTION WHEN unique_violation THEN
      -- ZIP already exists for this worker, update it
      BEGIN
        UPDATE worker_service_zipcodes 
        SET 
          service_area_id = p_area_id,
          from_polygon = true,
          updated_at = now()
        WHERE worker_id = p_worker_id 
          AND zipcode = zip_record.zipcode;
        
        operation_result := 'updated';
        operation_success := true;
        
      EXCEPTION WHEN OTHERS THEN
        operation_result := 'update_failed';
        operation_success := false;
        error_msg := SQLERRM;
      END;
      
    EXCEPTION WHEN OTHERS THEN
      operation_result := 'insert_failed';
      operation_success := false;
      error_msg := SQLERRM;
    END;
    
    -- Return result for this ZIP code
    RETURN QUERY SELECT 
      zip_record.zipcode,
      operation_result,
      operation_success,
      error_msg;
  END LOOP;
  
  RETURN;
END;
$$;

-- Create function to validate and clean polygon data
CREATE OR REPLACE FUNCTION public.validate_and_clean_polygon(
  polygon_input jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  cleaned_polygon jsonb;
  geom geometry;
BEGIN
  -- Handle different input formats
  IF polygon_input ? 'type' AND (polygon_input->>'type') = 'Polygon' THEN
    -- Already GeoJSON
    cleaned_polygon := polygon_input;
  ELSIF jsonb_typeof(polygon_input) = 'array' THEN
    -- Array of coordinate points - convert to GeoJSON
    cleaned_polygon := jsonb_build_object(
      'type', 'Polygon',
      'coordinates', jsonb_build_array(
        polygon_input || jsonb_build_array(polygon_input->0)
      )
    );
  ELSE
    RAISE EXCEPTION 'Invalid polygon format. Expected GeoJSON Polygon or array of coordinates';
  END IF;
  
  -- Validate the geometry
  BEGIN
    geom := ST_GeomFromGeoJSON(cleaned_polygon::text);
    
    IF NOT ST_IsValid(geom) THEN
      -- Try to fix invalid geometry
      geom := ST_MakeValid(geom);
      -- Convert back to GeoJSON
      cleaned_polygon := ST_AsGeoJSON(geom)::jsonb;
    END IF;
    
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Invalid polygon geometry: %', SQLERRM;
  END;
  
  RETURN cleaned_polygon;
END;
$$;