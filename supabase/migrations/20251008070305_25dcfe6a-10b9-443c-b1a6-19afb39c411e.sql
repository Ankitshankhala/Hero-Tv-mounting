-- Phase 1: Ensure spatial index exists on ZCTA polygons
CREATE INDEX IF NOT EXISTS idx_zcta_polygons_geom ON us_zcta_polygons USING GIST (geom);

-- Optimize the get_zcta_codes_for_polygon function
CREATE OR REPLACE FUNCTION public.get_zcta_codes_for_polygon(polygon_coords jsonb)
RETURNS text[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  polygon_geom GEOMETRY;
  zcta_codes TEXT[];
BEGIN
  -- Convert JSONB coordinates to PostGIS polygon geometry (WGS84/SRID 4326)
  polygon_geom := ST_SetSRID(
    ST_GeomFromGeoJSON(
      jsonb_build_object(
        'type', 'Polygon',
        'coordinates', jsonb_build_array(polygon_coords)
      )
    ),
    4326
  );
  
  -- Validate polygon
  IF polygon_geom IS NULL OR ST_IsEmpty(polygon_geom) THEN
    RETURN ARRAY[]::TEXT[];
  END IF;
  
  -- Find all ZCTA codes that spatially intersect with the polygon
  SELECT ARRAY_AGG(DISTINCT zcta5ce ORDER BY zcta5ce)
  INTO zcta_codes
  FROM public.us_zcta_polygons
  WHERE ST_Intersects(geom, polygon_geom);
  
  -- Return empty array if no intersections found
  RETURN COALESCE(zcta_codes, ARRAY[]::TEXT[]);
EXCEPTION WHEN OTHERS THEN
  -- Log error and return empty array
  RAISE WARNING 'Error in get_zcta_codes_for_polygon: %', SQLERRM;
  RETURN ARRAY[]::TEXT[];
END;
$$;