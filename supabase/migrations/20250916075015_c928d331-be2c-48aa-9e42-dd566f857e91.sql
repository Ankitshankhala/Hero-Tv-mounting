-- Fix coordinate system mismatch in load_zcta_polygons_batch function
-- Transform from EPSG:3857 (Web Mercator) to EPSG:4326 (WGS84)

CREATE OR REPLACE FUNCTION public.load_zcta_polygons_batch(batch_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  batch_item jsonb;
  inserted_count INTEGER := 0;
  error_count INTEGER := 0;
  error_details TEXT[];
BEGIN
  -- Process each item in the batch
  FOR batch_item IN SELECT jsonb_array_elements(batch_data)
  LOOP
    BEGIN
      -- Extract geometry data
      DECLARE
        zcta_code TEXT := batch_item->>'zcta5ce';
        geom_data jsonb := batch_item->'geometry';
        land_area_val NUMERIC := COALESCE((batch_item->>'land_area')::numeric, 0);
        water_area_val NUMERIC := COALESCE((batch_item->>'water_area')::numeric, 0);
      BEGIN
        -- Insert with coordinate transformation from EPSG:3857 to EPSG:4326
        INSERT INTO public.us_zcta_polygons (
          zcta5ce,
          geom,
          land_area,
          water_area
        ) VALUES (
          zcta_code,
          ST_Transform(ST_SetSRID(ST_GeomFromGeoJSON(geom_data::text), 3857), 4326),
          land_area_val,
          water_area_val
        )
        ON CONFLICT (zcta5ce) DO UPDATE SET
          geom = EXCLUDED.geom,
          land_area = EXCLUDED.land_area,
          water_area = EXCLUDED.water_area;
        
        inserted_count := inserted_count + 1;
      END;
    EXCEPTION
      WHEN OTHERS THEN
        error_count := error_count + 1;
        error_details := error_details || (SQLERRM || ' - ZCTA: ' || COALESCE(batch_item->>'zcta5ce', 'unknown'));
        
        -- Continue processing other items instead of failing the entire batch
        CONTINUE;
    END;
  END LOOP;
  
  -- Return processing results
  RETURN jsonb_build_object(
    'success', true,
    'inserted_count', inserted_count,
    'error_count', error_count,
    'error_details', error_details,
    'total_processed', inserted_count + error_count
  );
  
EXCEPTION
  WHEN OTHERS THEN
    -- Return error info for the entire batch
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'inserted_count', inserted_count,
      'error_count', error_count
    );
END;
$$;