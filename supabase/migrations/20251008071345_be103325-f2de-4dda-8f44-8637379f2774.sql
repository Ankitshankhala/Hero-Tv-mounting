-- Fix coordinate system mismatch in us_zcta_polygons table
-- Many polygons are stored in Web Mercator (EPSG:3857) but labeled as SRID 4326
-- This migration transforms them to proper WGS84 (EPSG:4326) coordinates

-- Step 1: Identify and fix geometries with coordinates outside WGS84 bounds
-- Valid WGS84: longitude -180 to 180, latitude -90 to 90
-- Web Mercator coordinates are much larger (e.g., -10879921, 3535803)

UPDATE public.us_zcta_polygons
SET geom = ST_Transform(ST_SetSRID(geom, 3857), 4326)
WHERE ST_XMax(geom) > 180 
   OR ST_XMin(geom) < -180 
   OR ST_YMax(geom) > 90 
   OR ST_YMin(geom) < -90;

-- Step 2: Ensure all geometries have correct SRID set
UPDATE public.us_zcta_polygons
SET geom = ST_SetSRID(geom, 4326)
WHERE ST_SRID(geom) != 4326;

-- Step 3: Update the get_zcta_codes_for_polygon function with better validation
CREATE OR REPLACE FUNCTION public.get_zcta_codes_for_polygon(polygon_coords jsonb)
RETURNS text[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  input_geom geometry;
  zcta_codes text[];
  coord_array jsonb;
BEGIN
  -- Input validation
  IF polygon_coords IS NULL OR jsonb_array_length(polygon_coords) = 0 THEN
    RAISE EXCEPTION 'Invalid polygon coordinates: empty or null';
  END IF;

  -- Handle both single array and nested array formats
  -- Check if first element is an array (nested format)
  IF jsonb_typeof(polygon_coords->0) = 'array' THEN
    coord_array := polygon_coords;
  ELSE
    -- Wrap in array for GeoJSON polygon format
    coord_array := jsonb_build_array(polygon_coords);
  END IF;

  -- Build valid GeoJSON polygon
  BEGIN
    input_geom := ST_SetSRID(
      ST_GeomFromGeoJSON(
        jsonb_build_object(
          'type', 'Polygon',
          'coordinates', coord_array
        )::text
      ),
      4326
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Failed to parse polygon geometry: %', SQLERRM;
  END;

  -- Validate geometry
  IF NOT ST_IsValid(input_geom) THEN
    input_geom := ST_MakeValid(input_geom);
  END IF;

  -- Find intersecting ZCTA codes with spatial index
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