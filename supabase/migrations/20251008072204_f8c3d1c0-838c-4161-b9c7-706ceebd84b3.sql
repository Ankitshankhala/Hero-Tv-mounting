-- Fix GeoJSON Polygon coordinate nesting in get_zcta_codes_for_polygon
-- The function now always wraps input coordinates in one additional array level
-- Input from UI: [[-105, 39], [-104, 39], ...] (2 levels)
-- GeoJSON Polygon needs: [[[-105, 39], [-104, 39], ...]] (3 levels)

CREATE OR REPLACE FUNCTION public.get_zcta_codes_for_polygon(polygon_coords jsonb)
RETURNS text[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  input_geom geometry;
  zcta_codes text[];
BEGIN
  -- Input validation
  IF polygon_coords IS NULL OR jsonb_array_length(polygon_coords) = 0 THEN
    RAISE EXCEPTION 'Invalid polygon coordinates: empty or null';
  END IF;

  -- Build GeoJSON Polygon with proper nesting
  -- Input is always a single ring: [[-105, 39], [-104, 39], ...]
  -- GeoJSON Polygon requires: [[[-105, 39], [-104, 39], ...]]
  BEGIN
    input_geom := ST_SetSRID(
      ST_GeomFromGeoJSON(
        jsonb_build_object(
          'type', 'Polygon',
          'coordinates', jsonb_build_array(polygon_coords)
        )::text
      ),
      4326
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Failed to parse polygon geometry: %', SQLERRM;
  END;

  -- Validate and fix geometry if needed
  IF NOT ST_IsValid(input_geom) THEN
    input_geom := ST_MakeValid(input_geom);
  END IF;

  -- Find intersecting ZCTA codes using spatial index
  SELECT ARRAY_AGG(DISTINCT zcta5ce ORDER BY zcta5ce)
  INTO zcta_codes
  FROM public.us_zcta_polygons
  WHERE ST_Intersects(geom, input_geom);

  -- Return empty array if no matches found
  RETURN COALESCE(zcta_codes, ARRAY[]::text[]);

EXCEPTION WHEN OTHERS THEN
  -- Log error and return empty array
  RAISE WARNING 'Error in get_zcta_codes_for_polygon: %', SQLERRM;
  RETURN ARRAY[]::text[];
END;
$$;