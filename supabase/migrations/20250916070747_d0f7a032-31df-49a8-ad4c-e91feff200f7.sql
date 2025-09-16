-- Drop and recreate the load_zcta_polygons_batch function to work with us_zcta_polygons table
DROP FUNCTION IF EXISTS public.load_zcta_polygons_batch(jsonb);

CREATE OR REPLACE FUNCTION public.load_zcta_polygons_batch(batch_data jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  feature jsonb;
  processed_count INTEGER := 0;
  error_count INTEGER := 0;
  errors jsonb := '[]'::jsonb;
  zcta_code TEXT;
  geom_data jsonb;
  land_area_val NUMERIC;
  water_area_val NUMERIC;
BEGIN
  -- Process each feature in the batch
  FOR feature IN SELECT jsonb_array_elements(batch_data)
  LOOP
    BEGIN
      -- Extract ZCTA code - handle both 2020 and 2010 Census field names
      zcta_code := COALESCE(
        feature->'properties'->>'ZCTA5CE20',  -- 2020 Census
        feature->'properties'->>'ZCTA5CE10',  -- 2010 Census (fallback)
        feature->'properties'->>'ZCTA5CE'     -- Generic fallback
      );
      
      -- Skip if no valid ZCTA code
      IF zcta_code IS NULL OR LENGTH(zcta_code) != 5 THEN
        error_count := error_count + 1;
        errors := errors || jsonb_build_object(
          'error', 'Invalid or missing ZCTA code',
          'zcta_code', COALESCE(zcta_code, 'NULL'),
          'properties', feature->'properties'
        );
        CONTINUE;
      END IF;
      
      -- Extract geometry
      geom_data := feature->'geometry';
      IF geom_data IS NULL THEN
        error_count := error_count + 1;
        errors := errors || jsonb_build_object(
          'error', 'Missing geometry',
          'zcta_code', zcta_code
        );
        CONTINUE;
      END IF;
      
      -- Extract land and water areas - handle both 2020 and 2010 Census field names
      land_area_val := COALESCE(
        (feature->'properties'->>'ALAND20')::NUMERIC,   -- 2020 Census
        (feature->'properties'->>'ALAND10')::NUMERIC,   -- 2010 Census (fallback)
        (feature->'properties'->>'ALAND')::NUMERIC,     -- Generic fallback
        0
      );
      
      water_area_val := COALESCE(
        (feature->'properties'->>'AWATER20')::NUMERIC,  -- 2020 Census
        (feature->'properties'->>'AWATER10')::NUMERIC,  -- 2010 Census (fallback)
        (feature->'properties'->>'AWATER')::NUMERIC,    -- Generic fallback
        0
      );
      
      -- Insert into us_zcta_polygons table (not comprehensive_zcta_polygons)
      INSERT INTO public.us_zcta_polygons (
        zcta5ce,
        geom,
        land_area,
        water_area,
        created_at
      ) VALUES (
        zcta_code,
        ST_GeomFromGeoJSON(geom_data::text),
        land_area_val,
        water_area_val,
        now()
      )
      ON CONFLICT (zcta5ce) DO UPDATE SET
        geom = EXCLUDED.geom,
        land_area = EXCLUDED.land_area,
        water_area = EXCLUDED.water_area,
        created_at = EXCLUDED.created_at;
      
      processed_count := processed_count + 1;
      
    EXCEPTION WHEN OTHERS THEN
      error_count := error_count + 1;
      errors := errors || jsonb_build_object(
        'error', SQLERRM,
        'zcta_code', COALESCE(zcta_code, 'unknown'),
        'sqlstate', SQLSTATE
      );
    END;
  END LOOP;
  
  -- Return results
  RETURN jsonb_build_object(
    'success', true,
    'processed_count', processed_count,
    'error_count', error_count,
    'errors', errors,
    'total_features', jsonb_array_length(batch_data)
  );
  
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM,
    'sqlstate', SQLSTATE,
    'processed_count', processed_count,
    'error_count', error_count
  );
END;
$function$;