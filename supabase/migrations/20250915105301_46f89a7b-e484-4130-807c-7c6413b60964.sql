-- Test importing a few ZIP codes manually to verify the import function works
-- Let's also create a function to import ZCTA polygon boundaries

-- First, let's add a function to load ZCTA polygons from Census data
CREATE OR REPLACE FUNCTION public.load_zcta_polygons_batch(
  polygon_data jsonb DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb := '{"success": false}'::jsonb;
  sample_polygons jsonb;
  polygon_record jsonb;
  inserted_count INTEGER := 0;
BEGIN
  -- If no data provided, create sample ZCTA polygons for testing
  IF polygon_data IS NULL THEN
    sample_polygons := '[
      {
        "zcta5ce": "10001",
        "geom": "POLYGON((-73.998 40.750, -73.995 40.750, -73.995 40.753, -73.998 40.753, -73.998 40.750))",
        "land_area": 500000,
        "water_area": 10000,
        "internal_lat": 40.7515,
        "internal_lng": -73.9965
      },
      {
        "zcta5ce": "10002", 
        "geom": "POLYGON((-73.992 40.715, -73.988 40.715, -73.988 40.718, -73.992 40.718, -73.992 40.715))",
        "land_area": 450000,
        "water_area": 5000,
        "internal_lat": 40.7165,
        "internal_lng": -73.9900
      },
      {
        "zcta5ce": "90210",
        "geom": "POLYGON((-118.420 34.090, -118.400 34.090, -118.400 34.110, -118.420 34.110, -118.420 34.090))",
        "land_area": 600000,
        "water_area": 0,
        "internal_lat": 34.1000,
        "internal_lng": -118.4100
      }
    ]'::jsonb;
  ELSE
    sample_polygons := polygon_data;
  END IF;

  -- Insert each polygon
  FOR polygon_record IN SELECT value FROM jsonb_array_elements(sample_polygons)
  LOOP
    BEGIN
      INSERT INTO comprehensive_zcta_polygons (
        zcta5ce,
        geom,
        land_area,
        water_area,
        internal_lat,
        internal_lng,
        data_source
      ) VALUES (
        polygon_record->>'zcta5ce',
        ST_GeomFromText(polygon_record->>'geom', 4326),
        (polygon_record->>'land_area')::numeric,
        (polygon_record->>'water_area')::numeric,
        (polygon_record->>'internal_lat')::numeric,
        (polygon_record->>'internal_lng')::numeric,
        'sample'
      )
      ON CONFLICT (zcta5ce) DO UPDATE SET
        geom = EXCLUDED.geom,
        land_area = EXCLUDED.land_area,
        water_area = EXCLUDED.water_area,
        internal_lat = EXCLUDED.internal_lat,
        internal_lng = EXCLUDED.internal_lng,
        data_source = EXCLUDED.data_source;
      
      inserted_count := inserted_count + 1;
    EXCEPTION WHEN OTHERS THEN
      -- Log error but continue with other polygons
      RAISE NOTICE 'Error inserting polygon for ZCTA %: %', polygon_record->>'zcta5ce', SQLERRM;
    END;
  END LOOP;

  result := jsonb_build_object(
    'success', true,
    'inserted_count', inserted_count,
    'message', format('Successfully loaded %s ZCTA polygons', inserted_count)
  );

  RETURN result;
END;
$$;