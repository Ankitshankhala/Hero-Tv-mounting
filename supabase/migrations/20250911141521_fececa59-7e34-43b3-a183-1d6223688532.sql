-- Create the missing PostGIS function for spatial intersection
CREATE OR REPLACE FUNCTION public.find_zipcodes_intersecting_polygon(polygon_coords jsonb)
RETURNS text[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  zipcode_array text[] := '{}';
  polygon_geom geometry;
  zip_record RECORD;
BEGIN
  -- Convert polygon coordinates to PostGIS geometry
  -- Expecting polygon_coords to be an array of {lat, lng} objects
  BEGIN
    WITH coords AS (
      SELECT 
        jsonb_array_elements(polygon_coords)->>'lng' AS lng,
        jsonb_array_elements(polygon_coords)->>'lat' AS lat
    )
    SELECT ST_MakePolygon(
      ST_MakeLine(
        array_append(
          ARRAY(SELECT ST_MakePoint(lng::numeric, lat::numeric) FROM coords),
          (SELECT ST_MakePoint(lng::numeric, lat::numeric) FROM coords LIMIT 1)
        )
      )
    ) INTO polygon_geom;
  EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'Failed to create polygon geometry: %', SQLERRM;
    RETURN zipcode_array;
  END;

  -- Find ZIP codes that intersect with the polygon using ZCTA polygons if available
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'us_zcta_polygons') THEN
    FOR zip_record IN 
      SELECT zcta5ce as zipcode
      FROM us_zcta_polygons 
      WHERE ST_Intersects(geom, polygon_geom)
      LIMIT 100
    LOOP
      zipcode_array := array_append(zipcode_array, zip_record.zipcode);
    END LOOP;
    
    RAISE LOG 'Found % ZIP codes using ZCTA polygons', array_length(zipcode_array, 1);
  END IF;

  -- If no ZCTA results or table doesn't exist, use point-based intersection with us_zip_codes
  IF array_length(zipcode_array, 1) IS NULL OR array_length(zipcode_array, 1) = 0 THEN
    FOR zip_record IN 
      SELECT zipcode
      FROM us_zip_codes 
      WHERE latitude IS NOT NULL 
        AND longitude IS NOT NULL
        AND ST_Contains(polygon_geom, ST_MakePoint(longitude::numeric, latitude::numeric))
      LIMIT 100
    LOOP
      zipcode_array := array_append(zipcode_array, zip_record.zipcode);
    END LOOP;
    
    RAISE LOG 'Found % ZIP codes using point-in-polygon with us_zip_codes', array_length(zipcode_array, 1);
  END IF;

  RETURN zipcode_array;
END;
$function$;