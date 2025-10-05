-- Drop existing function
DROP FUNCTION IF EXISTS public.insert_zcta_batch(JSONB);

-- Recreate with geometry type coercion to MultiPolygon
CREATE OR REPLACE FUNCTION public.insert_zcta_batch(batch_data JSONB)
RETURNS INTEGER AS $$
DECLARE
  inserted_count INTEGER := 0;
BEGIN
  INSERT INTO public.us_zcta_polygons (zcta5ce, geom, land_area, water_area)
  SELECT 
    (item->>'zcta5ce')::TEXT,
    ST_SetSRID(
      ST_Multi(
        ST_MakeValid(
          ST_GeomFromGeoJSON(item->>'geom')
        )
      ),
      4326
    ),
    (item->>'land_area')::NUMERIC,
    (item->>'water_area')::NUMERIC
  FROM jsonb_array_elements(batch_data) AS item
  ON CONFLICT (zcta5ce) DO UPDATE SET
    geom = EXCLUDED.geom,
    land_area = EXCLUDED.land_area,
    water_area = EXCLUDED.water_area;

  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RETURN inserted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create GIST spatial index if not exists
CREATE INDEX IF NOT EXISTS idx_us_zcta_polygons_geom 
ON public.us_zcta_polygons USING GIST (geom);