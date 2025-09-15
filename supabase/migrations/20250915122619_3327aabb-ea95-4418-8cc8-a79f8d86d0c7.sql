-- Fix the RPC function overloading issue
DROP FUNCTION IF EXISTS public.load_zcta_polygons_batch();

-- Create a single, properly parameterized function
CREATE OR REPLACE FUNCTION public.load_zcta_polygons_batch(polygon_data jsonb DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb := '{"success": false, "processed": 0, "errors": 0}'::jsonb;
  polygon_record jsonb;
  processed_count integer := 0;
  error_count integer := 0;
BEGIN
  -- If no data provided, just set up the table structure
  IF polygon_data IS NULL THEN
    -- Ensure the table exists with proper structure
    CREATE TABLE IF NOT EXISTS comprehensive_zcta_polygons (
      id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      zcta5ce text NOT NULL UNIQUE,
      geom geometry(MultiPolygon, 4326),
      land_area_sqm numeric,
      water_area_sqm numeric,
      created_at timestamp with time zone DEFAULT now(),
      updated_at timestamp with time zone DEFAULT now()
    );
    
    -- Create spatial index if it doesn't exist
    CREATE INDEX IF NOT EXISTS idx_comprehensive_zcta_polygons_geom 
    ON comprehensive_zcta_polygons USING GIST (geom);
    
    -- Create text index for ZCTA codes
    CREATE INDEX IF NOT EXISTS idx_comprehensive_zcta_polygons_zcta5ce 
    ON comprehensive_zcta_polygons (zcta5ce);
    
    RETURN jsonb_build_object(
      'success', true, 
      'message', 'ZCTA polygons table structure ready',
      'processed', 0,
      'errors', 0
    );
  END IF;
  
  -- Process the polygon data batch
  FOR polygon_record IN SELECT * FROM jsonb_array_elements(polygon_data)
  LOOP
    BEGIN
      INSERT INTO comprehensive_zcta_polygons (
        zcta5ce, 
        geom, 
        land_area_sqm, 
        water_area_sqm
      ) VALUES (
        polygon_record->>'zcta5ce',
        ST_GeomFromGeoJSON(polygon_record->>'geometry'),
        (polygon_record->>'aland')::numeric,
        (polygon_record->>'awater')::numeric
      )
      ON CONFLICT (zcta5ce) DO UPDATE SET
        geom = EXCLUDED.geom,
        land_area_sqm = EXCLUDED.land_area_sqm,
        water_area_sqm = EXCLUDED.water_area_sqm,
        updated_at = now();
      
      processed_count := processed_count + 1;
      
    EXCEPTION WHEN OTHERS THEN
      error_count := error_count + 1;
      -- Log error but continue processing
      RAISE WARNING 'Error processing ZCTA %: %', 
        polygon_record->>'zcta5ce', SQLERRM;
    END;
  END LOOP;
  
  RETURN jsonb_build_object(
    'success', true,
    'processed', processed_count,
    'errors', error_count,
    'message', format('Processed %s polygons with %s errors', processed_count, error_count)
  );
  
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM,
    'processed', processed_count,
    'errors', error_count
  );
END;
$$;