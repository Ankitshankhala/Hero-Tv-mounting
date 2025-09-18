-- Phase 1: Database Consolidation - Create comprehensive tables with proper indexes

-- Drop existing incomplete tables to avoid confusion
DROP TABLE IF EXISTS zip_polygons CASCADE;

-- Ensure comprehensive_zip_codes has all required columns and constraints
ALTER TABLE comprehensive_zip_codes 
ADD COLUMN IF NOT EXISTS internal_lat NUMERIC,
ADD COLUMN IF NOT EXISTS internal_lng NUMERIC;

-- Create spatial index on comprehensive_zcta_polygons if not exists
CREATE INDEX IF NOT EXISTS idx_comprehensive_zcta_polygons_geom ON comprehensive_zcta_polygons USING GIST(geom);
CREATE INDEX IF NOT EXISTS idx_comprehensive_zcta_polygons_zcta5ce ON comprehensive_zcta_polygons(zcta5ce);

-- Create spatial index on comprehensive_zip_codes for coordinates
CREATE INDEX IF NOT EXISTS idx_comprehensive_zip_codes_coords ON comprehensive_zip_codes(latitude, longitude) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_comprehensive_zip_codes_zipcode ON comprehensive_zip_codes(zipcode);
CREATE INDEX IF NOT EXISTS idx_comprehensive_zip_codes_state ON comprehensive_zip_codes(state_abbr);

-- Create function to get comprehensive ZIP coverage with caching
CREATE OR REPLACE FUNCTION get_comprehensive_zip_coverage(p_zipcode TEXT)
RETURNS TABLE(
  zipcode TEXT,
  has_coverage BOOLEAN,
  worker_count INTEGER,
  city TEXT,
  state_abbr TEXT,
  latitude NUMERIC,
  longitude NUMERIC,
  data_source TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    czc.zipcode,
    zip_has_active_coverage_by_zip(czc.zipcode) as has_coverage,
    get_worker_count_by_zip(czc.zipcode) as worker_count,
    czc.city,
    czc.state_abbr,
    czc.latitude,
    czc.longitude,
    czc.data_source
  FROM comprehensive_zip_codes czc
  WHERE czc.zipcode = p_zipcode;
END;
$function$;

-- Create function to get batch ZIP coordinates from comprehensive table
CREATE OR REPLACE FUNCTION get_comprehensive_batch_zip_coordinates(p_zipcodes TEXT[])
RETURNS TABLE(
  zipcode TEXT,
  latitude NUMERIC,
  longitude NUMERIC,
  city TEXT,
  state_abbr TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    czc.zipcode,
    czc.latitude,
    czc.longitude,
    czc.city,
    czc.state_abbr
  FROM comprehensive_zip_codes czc
  WHERE czc.zipcode = ANY(p_zipcodes)
  AND czc.latitude IS NOT NULL 
  AND czc.longitude IS NOT NULL;
END;
$function$;

-- Create function to get worker ZIP coordinates using comprehensive data
CREATE OR REPLACE FUNCTION get_comprehensive_worker_zip_coordinates(p_worker_id UUID)
RETURNS TABLE(
  zipcode TEXT,
  latitude NUMERIC,
  longitude NUMERIC,
  city TEXT,
  state_abbr TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    czc.zipcode,
    czc.latitude,
    czc.longitude,
    czc.city,
    czc.state_abbr
  FROM worker_service_zipcodes wsz
  INNER JOIN worker_service_areas wsa ON wsz.service_area_id = wsa.id
  INNER JOIN comprehensive_zip_codes czc ON wsz.zipcode = czc.zipcode
  WHERE wsa.worker_id = p_worker_id
  AND wsa.is_active = true
  AND czc.latitude IS NOT NULL 
  AND czc.longitude IS NOT NULL;
END;
$function$;

-- Create function to get ZCTA boundary from comprehensive table
CREATE OR REPLACE FUNCTION get_comprehensive_zcta_boundary(p_zcta_code TEXT)
RETURNS TABLE(
  zcta5ce TEXT,
  geom_geojson JSONB,
  land_area NUMERIC,
  water_area NUMERIC,
  data_source TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    czp.zcta5ce,
    ST_AsGeoJSON(czp.geom)::JSONB as geom_geojson,
    czp.land_area,
    czp.water_area,
    czp.data_source
  FROM comprehensive_zcta_polygons czp
  WHERE czp.zcta5ce = p_zcta_code;
END;
$function$;