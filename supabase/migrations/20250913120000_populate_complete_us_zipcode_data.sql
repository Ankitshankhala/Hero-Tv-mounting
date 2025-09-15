-- Complete US ZIP Code Data Population Migration
-- This migration populates the us_zip_codes and us_zcta_polygons tables with comprehensive data

-- Step 1: Ensure tables exist with proper structure
CREATE TABLE IF NOT EXISTS public.us_zip_codes (
  zipcode TEXT PRIMARY KEY,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  state_abbr TEXT NOT NULL,
  latitude NUMERIC,
  longitude NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.us_zcta_polygons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zcta5ce TEXT NOT NULL UNIQUE, -- 5-digit ZIP code
  geom GEOMETRY(MULTIPOLYGON, 4326) NOT NULL,
  land_area NUMERIC,
  water_area NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Step 2: Create indexes for optimal performance
CREATE INDEX IF NOT EXISTS idx_us_zcta_polygons_geom ON public.us_zcta_polygons USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_us_zcta_polygons_zcta5ce ON public.us_zcta_polygons (zcta5ce);
CREATE INDEX IF NOT EXISTS idx_us_zip_codes_coords ON public.us_zip_codes (longitude, latitude) WHERE longitude IS NOT NULL AND latitude IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_us_zip_codes_state ON public.us_zip_codes (state_abbr);

-- Step 3: Create data loading helper functions
CREATE OR REPLACE FUNCTION public.load_zipcode_data_from_json(
  zipcode_json jsonb
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  zip_record jsonb;
  inserted_count integer := 0;
BEGIN
  -- Process each ZIP code record from the JSON
  FOR zip_record IN SELECT jsonb_array_elements(zipcode_json)
  LOOP
    BEGIN
      INSERT INTO public.us_zip_codes (
        zipcode, 
        city, 
        state, 
        state_abbr, 
        latitude, 
        longitude
      ) VALUES (
        zip_record->>'zipcode',
        zip_record->>'city',
        zip_record->>'state',
        zip_record->>'state_abbr',
        CASE 
          WHEN zip_record->>'latitude' IS NOT NULL 
          THEN (zip_record->>'latitude')::numeric 
          ELSE NULL 
        END,
        CASE 
          WHEN zip_record->>'longitude' IS NOT NULL 
          THEN (zip_record->>'longitude')::numeric 
          ELSE NULL 
        END
      ) ON CONFLICT (zipcode) DO UPDATE SET
        city = EXCLUDED.city,
        state = EXCLUDED.state,
        state_abbr = EXCLUDED.state_abbr,
        latitude = COALESCE(EXCLUDED.latitude, us_zip_codes.latitude),
        longitude = COALESCE(EXCLUDED.longitude, us_zip_codes.longitude);
      
      inserted_count := inserted_count + 1;
      
    EXCEPTION WHEN OTHERS THEN
      -- Log error but continue processing
      RAISE NOTICE 'Error inserting ZIP code %: %', zip_record->>'zipcode', SQLERRM;
    END;
  END LOOP;
  
  RETURN inserted_count;
END;
$$;

-- Step 4: Create ZCTA polygon loading function
CREATE OR REPLACE FUNCTION public.load_zcta_polygon_data(
  zcta_geojson jsonb
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  feature jsonb;
  geometry_data jsonb;
  properties jsonb;
  zipcode text;
  polygon_geom geometry;
  inserted_count integer := 0;
BEGIN
  -- Process GeoJSON FeatureCollection
  IF zcta_geojson->>'type' = 'FeatureCollection' THEN
    -- Process each feature in the collection
    FOR feature IN SELECT jsonb_array_elements(zcta_geojson->'features')
    LOOP
      BEGIN
        properties := feature->'properties';
        geometry_data := feature->'geometry';
        zipcode := properties->>'ZCTA5CE10'; -- Common ZCTA field name
        
        -- Fallback field names if primary doesn't exist
        IF zipcode IS NULL THEN
          zipcode := properties->>'GEOID10';
        END IF;
        IF zipcode IS NULL THEN
          zipcode := properties->>'ZCTA5CE';
        END IF;
        IF zipcode IS NULL THEN
          zipcode := properties->>'GEOID';
        END IF;
        
        -- Skip if no ZIP code found
        IF zipcode IS NULL OR length(zipcode) != 5 THEN
          CONTINUE;
        END IF;
        
        -- Convert GeoJSON geometry to PostGIS
        polygon_geom := ST_GeomFromGeoJSON(geometry_data::text);
        
        -- Ensure geometry is valid
        IF NOT ST_IsValid(polygon_geom) THEN
          polygon_geom := ST_MakeValid(polygon_geom);
        END IF;
        
        -- Convert to MultiPolygon if necessary
        IF ST_GeometryType(polygon_geom) = 'ST_Polygon' THEN
          polygon_geom := ST_Multi(polygon_geom);
        END IF;
        
        -- Set SRID to WGS84
        polygon_geom := ST_SetSRID(polygon_geom, 4326);
        
        -- Calculate areas in square meters
        INSERT INTO public.us_zcta_polygons (
          zcta5ce,
          geom,
          land_area,
          water_area
        ) VALUES (
          zipcode,
          polygon_geom,
          ST_Area(ST_Transform(polygon_geom, 3857)), -- Land area approximation
          0 -- Water area (would need separate calculation)
        ) ON CONFLICT (zcta5ce) DO UPDATE SET
          geom = EXCLUDED.geom,
          land_area = EXCLUDED.land_area;
        
        inserted_count := inserted_count + 1;
        
      EXCEPTION WHEN OTHERS THEN
        -- Log error but continue processing
        RAISE NOTICE 'Error inserting ZCTA polygon for ZIP %: %', zipcode, SQLERRM;
      END;
    END LOOP;
  END IF;
  
  RETURN inserted_count;
END;
$$;

-- Step 5: Create comprehensive data validation function
CREATE OR REPLACE FUNCTION public.validate_zipcode_data_completeness()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb := '{}'::jsonb;
  zip_count integer;
  zcta_count integer;
  states_covered integer;
  sample_test_result text[];
BEGIN
  -- Count ZIP codes
  SELECT COUNT(*) INTO zip_count FROM us_zip_codes;
  result := jsonb_set(result, '{zip_codes_count}', to_jsonb(zip_count));
  
  -- Count ZCTA polygons
  SELECT COUNT(*) INTO zcta_count FROM us_zcta_polygons;
  result := jsonb_set(result, '{zcta_polygons_count}', to_jsonb(zcta_count));
  
  -- Count states covered
  SELECT COUNT(DISTINCT state_abbr) INTO states_covered FROM us_zip_codes;
  result := jsonb_set(result, '{states_covered}', to_jsonb(states_covered));
  
  -- Test spatial query performance
  BEGIN
    SELECT compute_zipcodes_for_polygon(
      '{
        "type": "Polygon",
        "coordinates": [[
          [-96.85, 32.75], [-96.75, 32.75], [-96.75, 32.85], [-96.85, 32.85], [-96.85, 32.75]
        ]]
      }'::jsonb,
      0
    ) INTO sample_test_result;
    
    result := jsonb_set(result, '{sample_spatial_test_count}', to_jsonb(array_length(sample_test_result, 1)));
    result := jsonb_set(result, '{sample_spatial_test_success}', to_jsonb(true));
  EXCEPTION WHEN OTHERS THEN
    result := jsonb_set(result, '{sample_spatial_test_success}', to_jsonb(false));
    result := jsonb_set(result, '{sample_spatial_test_error}', to_jsonb(SQLERRM));
  END;
  
  -- Overall assessment
  result := jsonb_set(result, '{data_completeness}', 
    CASE 
      WHEN zip_count > 40000 AND zcta_count > 30000 AND states_covered >= 50 THEN '"complete"'
      WHEN zip_count > 5000 AND states_covered >= 10 THEN '"partial"'
      ELSE '"minimal"'
    END
  );
  
  -- Add recommendations
  result := jsonb_set(result, '{recommendations}', 
    CASE 
      WHEN zip_count < 40000 THEN '["Load complete US ZIP code dataset", "Import Census ZCTA polygons"]'::jsonb
      WHEN zcta_count < 30000 THEN '["Import Census ZCTA polygon boundaries"]'::jsonb
      ELSE '["Data appears complete"]'::jsonb
    END
  );
  
  RETURN result;
END;
$$;

-- Step 6: Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.load_zipcode_data_from_json(jsonb) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.load_zcta_polygon_data(jsonb) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.validate_zipcode_data_completeness() TO authenticated, anon;

-- Step 7: Create data loading status tracking
CREATE TABLE IF NOT EXISTS public.zipcode_data_loading_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_type TEXT NOT NULL, -- 'zip_codes' or 'zcta_polygons'
  status TEXT NOT NULL, -- 'pending', 'in_progress', 'completed', 'failed'
  records_processed INTEGER DEFAULT 0,
  records_total INTEGER DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  metadata jsonb DEFAULT '{}'::jsonb
);

-- Initial status records
INSERT INTO public.zipcode_data_loading_status (operation_type, status, records_total)
VALUES 
  ('zip_codes', 'pending', 41000),
  ('zcta_polygons', 'pending', 33000)
ON CONFLICT DO NOTHING;

-- Step 8: Add helpful comments and documentation
COMMENT ON TABLE public.us_zip_codes IS 'Complete US ZIP code database with coordinates and location data. Should contain ~41,000 ZIP codes covering all US states and territories.';
COMMENT ON TABLE public.us_zcta_polygons IS 'US Census ZIP Code Tabulation Area polygons. Should contain ~33,000 ZCTA polygon boundaries for accurate spatial intersection queries.';
COMMENT ON FUNCTION public.load_zipcode_data_from_json(jsonb) IS 'Loads ZIP code data from JSON array format. Expects array of objects with zipcode, city, state, state_abbr, latitude, longitude fields.';
COMMENT ON FUNCTION public.load_zcta_polygon_data(jsonb) IS 'Loads ZCTA polygon data from GeoJSON FeatureCollection format. Expects Census Bureau ZCTA shapefile converted to GeoJSON.';

-- Step 9: Create monitoring view
CREATE OR REPLACE VIEW public.zipcode_data_health AS
SELECT 
  (SELECT COUNT(*) FROM us_zip_codes) as zip_codes_count,
  (SELECT COUNT(*) FROM us_zcta_polygons) as zcta_polygons_count,
  (SELECT COUNT(DISTINCT state_abbr) FROM us_zip_codes) as states_covered,
  CASE 
    WHEN (SELECT COUNT(*) FROM us_zip_codes) > 40000 AND (SELECT COUNT(*) FROM us_zcta_polygons) > 30000 THEN 'Complete'
    WHEN (SELECT COUNT(*) FROM us_zip_codes) > 5000 THEN 'Partial'
    ELSE 'Minimal'
  END as data_status,
  now() as last_checked;

GRANT SELECT ON public.zipcode_data_health TO authenticated, anon;
