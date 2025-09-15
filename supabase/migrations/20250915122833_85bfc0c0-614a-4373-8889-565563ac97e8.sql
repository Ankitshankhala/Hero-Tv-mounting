-- Replace load_zcta_polygons_batch to match existing schema and avoid ON CONFLICT
CREATE OR REPLACE FUNCTION public.load_zcta_polygons_batch(polygon_data jsonb DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  polygon_record jsonb;
  processed_count integer := 0;
  error_count integer := 0;
  v_zcta text;
  v_geom geometry;
  v_land numeric;
  v_water numeric;
BEGIN
  IF polygon_data IS NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'message', 'ZCTA polygons table ready',
      'processed', 0,
      'errors', 0
    );
  END IF;

  FOR polygon_record IN SELECT * FROM jsonb_array_elements(polygon_data)
  LOOP
    BEGIN
      -- Extract fields defensively from either flat or GeoJSON Feature format
      v_zcta := COALESCE(
        polygon_record->>'zcta5ce',
        polygon_record->'properties'->>'ZCTA5CE10',
        polygon_record->'properties'->>'ZCTA5CE',
        polygon_record->'properties'->>'ZCTA5',
        polygon_record->'properties'->>'ZIP',
        polygon_record->'properties'->>'ZIPCODE'
      );

      -- Normalize to 5-char string when numeric
      IF v_zcta IS NOT NULL THEN
        v_zcta := LPAD(TRIM(v_zcta), 5, '0');
      END IF;

      v_geom := ST_Multi(
        ST_SetSRID(
          ST_GeomFromGeoJSON(
            COALESCE(
              polygon_record->>'geometry',
              (polygon_record->'geometry')::text
            )
          ),
          4326
        )
      );

      v_land := COALESCE(
        NULLIF(polygon_record->>'aland', '')::numeric,
        NULLIF(polygon_record->'properties'->>'ALAND10', '')::numeric,
        NULLIF(polygon_record->'properties'->>'ALAND', '')::numeric
      );

      v_water := COALESCE(
        NULLIF(polygon_record->>'awater', '')::numeric,
        NULLIF(polygon_record->'properties'->>'AWATER10', '')::numeric,
        NULLIF(polygon_record->'properties'->>'AWATER', '')::numeric
      );

      IF v_zcta IS NULL OR v_geom IS NULL THEN
        error_count := error_count + 1;
      ELSE
        -- Upsert without requiring a UNIQUE on zcta5ce
        IF EXISTS (SELECT 1 FROM comprehensive_zcta_polygons WHERE zcta5ce = v_zcta) THEN
          UPDATE comprehensive_zcta_polygons
          SET geom = v_geom,
              land_area = COALESCE(v_land, land_area),
              water_area = COALESCE(v_water, water_area)
          WHERE zcta5ce = v_zcta;
        ELSE
          INSERT INTO comprehensive_zcta_polygons (zcta5ce, geom, land_area, water_area, data_source)
          VALUES (v_zcta, v_geom, v_land, v_water, 'census');
        END IF;

        processed_count := processed_count + 1;
      END IF;

    EXCEPTION WHEN OTHERS THEN
      error_count := error_count + 1;
      RAISE WARNING 'Error processing ZCTA record: %', SQLERRM;
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'processed', processed_count,
    'errors', error_count
  );
END;
$$;