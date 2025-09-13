-- Create unified spatial function for consistent ZIP code lookup
CREATE OR REPLACE FUNCTION public.find_zipcodes_in_polygon_geojson(
  polygon_geojson jsonb,
  min_overlap_percent numeric DEFAULT 0.1
) 
RETURNS TABLE (zipcode text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  polygon_geometry geometry;
  zipcode_count integer := 0;
BEGIN
  -- Convert GeoJSON to PostGIS geometry
  polygon_geometry := ST_GeomFromGeoJSON(polygon_geojson::text);
  
  -- Ensure valid geometry
  IF NOT ST_IsValid(polygon_geometry) THEN
    polygon_geometry := ST_MakeValid(polygon_geometry);
  END IF;
  
  -- Transform to appropriate projection for area calculations if needed
  IF ST_SRID(polygon_geometry) = 4326 THEN
    -- Transform to Web Mercator for more accurate area calculations
    polygon_geometry := ST_Transform(polygon_geometry, 3857);
  END IF;
  
  -- Find ZIP codes using spatial intersection with the ZCTA polygons
  RETURN QUERY
  SELECT DISTINCT uz.zcta5ce as zipcode
  FROM us_zcta_polygons uz
  WHERE ST_Intersects(
    CASE 
      WHEN ST_SRID(uz.geom) = ST_SRID(polygon_geometry) THEN uz.geom
      ELSE ST_Transform(uz.geom, ST_SRID(polygon_geometry))
    END,
    polygon_geometry
  )
  AND (
    min_overlap_percent = 0 OR
    ST_Area(ST_Intersection(
      CASE 
        WHEN ST_SRID(uz.geom) = ST_SRID(polygon_geometry) THEN uz.geom
        ELSE ST_Transform(uz.geom, ST_SRID(polygon_geometry))
      END,
      polygon_geometry
    )) / GREATEST(ST_Area(
      CASE 
        WHEN ST_SRID(uz.geom) = ST_SRID(polygon_geometry) THEN uz.geom
        ELSE ST_Transform(uz.geom, ST_SRID(polygon_geometry))
      END
    ), 1) >= min_overlap_percent / 100.0
  )
  ORDER BY uz.zcta5ce;
END;
$$;

-- Create function to validate and clean polygon data
CREATE OR REPLACE FUNCTION public.validate_and_clean_polygon(
  polygon_input jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  cleaned_polygon jsonb;
  geom geometry;
BEGIN
  -- Handle different input formats
  IF polygon_input ? 'type' AND (polygon_input->>'type') = 'Polygon' THEN
    -- Already GeoJSON
    cleaned_polygon := polygon_input;
  ELSIF jsonb_typeof(polygon_input) = 'array' THEN
    -- Array of coordinate points - convert to GeoJSON
    cleaned_polygon := jsonb_build_object(
      'type', 'Polygon',
      'coordinates', jsonb_build_array(
        polygon_input || jsonb_build_array(polygon_input->0)
      )
    );
  ELSE
    RAISE EXCEPTION 'Invalid polygon format. Expected GeoJSON Polygon or array of coordinates';
  END IF;
  
  -- Validate the geometry
  geom := ST_GeomFromGeoJSON(cleaned_polygon::text);
  
  IF NOT ST_IsValid(geom) THEN
    -- Try to fix invalid geometry
    geom := ST_MakeValid(geom);
    -- Convert back to GeoJSON
    cleaned_polygon := ST_AsGeoJSON(geom)::jsonb;
  END IF;
  
  RETURN cleaned_polygon;
END;
$$;