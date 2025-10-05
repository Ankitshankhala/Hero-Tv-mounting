-- Phase 1: Fix get_zcta_codes_for_polygon to query us_zcta_polygons instead of dropped zcta_zipcodes table
CREATE OR REPLACE FUNCTION public.get_zcta_codes_for_polygon(polygon_coords JSONB)
RETURNS TEXT[] AS $$
DECLARE
  polygon_geom GEOMETRY;
  zcta_codes TEXT[];
BEGIN
  -- Convert polygon coordinates to PostGIS geometry (SRID 4326 = WGS84)
  SELECT ST_SetSRID(ST_GeomFromGeoJSON(
    jsonb_build_object(
      'type', 'Polygon',
      'coordinates', jsonb_build_array(polygon_coords)
    )
  ), 4326) INTO polygon_geom;
  
  -- Find intersecting ZCTA codes from us_zcta_polygons using spatial index
  SELECT ARRAY_AGG(DISTINCT zcta5ce ORDER BY zcta5ce)
  INTO zcta_codes
  FROM public.us_zcta_polygons
  WHERE ST_Intersects(geom, polygon_geom);
  
  RETURN COALESCE(zcta_codes, ARRAY[]::TEXT[]);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Phase 2: Create batch insert helper function for ZCTA import
CREATE OR REPLACE FUNCTION public.insert_zcta_batch(batch_data JSONB)
RETURNS INTEGER AS $$
DECLARE
  inserted_count INTEGER := 0;
BEGIN
  -- Insert batch of ZCTA polygons from GeoJSON features
  INSERT INTO public.us_zcta_polygons (zcta5ce, geom, land_area, water_area)
  SELECT 
    (item->>'zcta5ce')::TEXT,
    ST_GeomFromGeoJSON(item->>'geom'),
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