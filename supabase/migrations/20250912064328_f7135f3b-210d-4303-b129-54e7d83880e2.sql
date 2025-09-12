-- Enhanced ZIP boundary integration with visualization support

-- Step 1: Create function to get ZIP boundary as GeoJSON for visualization
CREATE OR REPLACE FUNCTION public.get_zipcode_boundary_geojson(zipcode_param text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  boundary_geojson jsonb;
BEGIN
  SELECT ST_AsGeoJSON(geom)::jsonb INTO boundary_geojson
  FROM public.us_zcta_polygons
  WHERE zcta5ce = zipcode_param;
  
  RETURN boundary_geojson;
END;
$$;

-- Step 2: Enhanced function to find all ZIP codes within service area with boundaries
CREATE OR REPLACE FUNCTION public.get_service_area_zipcodes_with_boundaries(
  polygon_coords jsonb,
  include_boundaries boolean DEFAULT false
)
RETURNS TABLE(zipcode text, boundary_geojson jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  polygon_geom geometry;
BEGIN
  -- Convert JSON polygon to PostGIS geometry
  polygon_geom := ST_GeomFromGeoJSON(polygon_coords);
  
  -- Return ZIP codes with optional boundaries
  RETURN QUERY
  SELECT 
    uz.zcta5ce::text,
    CASE 
      WHEN include_boundaries THEN ST_AsGeoJSON(uz.geom)::jsonb
      ELSE NULL
    END
  FROM public.us_zcta_polygons uz
  WHERE ST_Intersects(polygon_geom, uz.geom)
  ORDER BY uz.zcta5ce;
END;
$$;

-- Step 3: Function to validate polygon coverage against ZIP boundaries
CREATE OR REPLACE FUNCTION public.validate_polygon_coverage(polygon_coords jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  polygon_geom geometry;
  total_zips integer;
  covered_area numeric;
  total_polygon_area numeric;
  result jsonb;
BEGIN
  -- Convert JSON polygon to geometry
  polygon_geom := ST_GeomFromGeoJSON(polygon_coords);
  
  -- Calculate coverage metrics
  SELECT COUNT(*) INTO total_zips
  FROM public.us_zcta_polygons uz
  WHERE ST_Intersects(polygon_geom, uz.geom);
  
  -- Calculate area coverage (in square meters)
  SELECT ST_Area(ST_Transform(polygon_geom, 3857)) INTO total_polygon_area;
  
  SELECT COALESCE(SUM(ST_Area(ST_Transform(ST_Intersection(polygon_geom, uz.geom), 3857))), 0)
  INTO covered_area
  FROM public.us_zcta_polygons uz
  WHERE ST_Intersects(polygon_geom, uz.geom);
  
  -- Build result object
  result := jsonb_build_object(
    'total_zipcodes', total_zips,
    'polygon_area_sq_km', ROUND((total_polygon_area / 1000000)::numeric, 2),
    'covered_area_sq_km', ROUND((covered_area / 1000000)::numeric, 2),
    'coverage_percentage', 
      CASE 
        WHEN total_polygon_area > 0 THEN ROUND((covered_area / total_polygon_area * 100)::numeric, 2)
        ELSE 0
      END,
    'validation_success', true
  );
  
  RETURN result;
END;
$$;

-- Step 4: Function to get nearby ZIP boundaries for map visualization
CREATE OR REPLACE FUNCTION public.get_nearby_zip_boundaries(
  center_lat numeric,
  center_lng numeric,
  radius_km numeric DEFAULT 50
)
RETURNS TABLE(zipcode text, boundary_geojson jsonb, distance_km numeric)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  center_point geometry;
BEGIN
  -- Create center point
  center_point := ST_SetSRID(ST_MakePoint(center_lng, center_lat), 4326);
  
  RETURN QUERY
  SELECT 
    uz.zcta5ce::text,
    ST_AsGeoJSON(uz.geom)::jsonb,
    ROUND((ST_Distance(ST_Transform(center_point, 3857), ST_Transform(ST_Centroid(uz.geom), 3857)) / 1000)::numeric, 2)
  FROM public.us_zcta_polygons uz
  WHERE ST_DWithin(
    ST_Transform(center_point, 3857), 
    ST_Transform(ST_Centroid(uz.geom), 3857), 
    radius_km * 1000
  )
  ORDER BY ST_Distance(ST_Transform(center_point, 3857), ST_Transform(ST_Centroid(uz.geom), 3857))
  LIMIT 100;
END;
$$;

-- Step 5: Grant permissions
GRANT EXECUTE ON FUNCTION public.get_zipcode_boundary_geojson TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_service_area_zipcodes_with_boundaries TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.validate_polygon_coverage TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_nearby_zip_boundaries TO authenticated, anon;