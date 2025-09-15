-- Create function to load ZCTA polygons from uploaded shapefile data
CREATE OR REPLACE FUNCTION public.load_zcta_polygons_from_data(
  polygon_data jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb := '{"success": false, "processed": 0, "errors": 0}'::jsonb;
  record_count integer := 0;
  error_count integer := 0;
  polygon_record jsonb;
  geom_wkt text;
  polygon_geom geometry;
BEGIN
  -- Process each polygon record from the input data
  FOR polygon_record IN SELECT jsonb_array_elements(polygon_data->'features')
  LOOP
    BEGIN
      -- Extract ZCTA code from properties
      IF polygon_record->'properties'->>'ZCTA5CE20' IS NOT NULL THEN
        -- Extract geometry as WKT or GeoJSON
        geom_wkt := polygon_record->'geometry'->>'coordinates';
        
        -- Convert GeoJSON geometry to PostGIS geometry
        polygon_geom := ST_GeomFromGeoJSON(polygon_record->'geometry'::text);
        
        -- Ensure geometry is valid and in correct SRID (4326)
        polygon_geom := ST_SetSRID(polygon_geom, 4326);
        
        -- Insert or update the polygon
        INSERT INTO comprehensive_zcta_polygons (
          zcta5ce,
          geom,
          land_area,
          water_area,
          internal_lat,
          internal_lng,
          data_source
        ) VALUES (
          polygon_record->'properties'->>'ZCTA5CE20',
          polygon_geom,
          COALESCE((polygon_record->'properties'->>'ALAND20')::numeric, 0),
          COALESCE((polygon_record->'properties'->>'AWATER20')::numeric, 0),
          COALESCE((polygon_record->'properties'->>'INTPTLAT20')::numeric, ST_Y(ST_Centroid(polygon_geom))),
          COALESCE((polygon_record->'properties'->>'INTPTLON20')::numeric, ST_X(ST_Centroid(polygon_geom))),
          'census_shapefile'
        )
        ON CONFLICT (zcta5ce) 
        DO UPDATE SET
          geom = EXCLUDED.geom,
          land_area = EXCLUDED.land_area,
          water_area = EXCLUDED.water_area,
          internal_lat = EXCLUDED.internal_lat,
          internal_lng = EXCLUDED.internal_lng,
          data_source = EXCLUDED.data_source;
        
        record_count := record_count + 1;
      END IF;
      
    EXCEPTION WHEN OTHERS THEN
      error_count := error_count + 1;
      -- Log error but continue processing
      RAISE WARNING 'Error processing ZCTA polygon: %', SQLERRM;
    END;
  END LOOP;
  
  -- Return results
  result := jsonb_set(result, '{success}', 'true');
  result := jsonb_set(result, '{processed}', record_count::text::jsonb);
  result := jsonb_set(result, '{errors}', error_count::text::jsonb);
  
  RETURN result;
END;
$$;

-- Create function to import ZCTA polygons in batches for large files
CREATE OR REPLACE FUNCTION public.load_zcta_polygons_batch()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb := '{"success": false, "message": "Direct shapefile import setup complete"}'::jsonb;
BEGIN
  -- This function sets up the infrastructure for direct import
  -- The actual import will be handled by the edge function with file upload
  
  -- Ensure the table has proper indexes for performance
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'comprehensive_zcta_polygons' 
    AND indexname = 'idx_zcta_polygons_geom'
  ) THEN
    CREATE INDEX CONCURRENTLY idx_zcta_polygons_geom 
    ON comprehensive_zcta_polygons USING GIST (geom);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'comprehensive_zcta_polygons' 
    AND indexname = 'idx_zcta_polygons_zcta5ce'
  ) THEN
    CREATE INDEX CONCURRENTLY idx_zcta_polygons_zcta5ce 
    ON comprehensive_zcta_polygons (zcta5ce);
  END IF;
  
  result := jsonb_set(result, '{success}', 'true');
  result := jsonb_set(result, '{message}', '"Database functions and indexes created for direct shapefile import"');
  
  RETURN result;
END;
$$;