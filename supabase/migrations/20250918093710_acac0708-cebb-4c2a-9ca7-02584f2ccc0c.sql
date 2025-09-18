-- Phase 1: Database Consolidation - Fix function conflicts and create comprehensive system

-- Drop existing incomplete tables to avoid confusion
DROP TABLE IF EXISTS zip_polygons CASCADE;

-- Drop existing functions that need to be recreated with new signatures
DROP FUNCTION IF EXISTS get_comprehensive_zip_coverage(TEXT);
DROP FUNCTION IF EXISTS get_comprehensive_batch_zip_coordinates(TEXT[]);
DROP FUNCTION IF EXISTS get_comprehensive_worker_zip_coordinates(UUID);
DROP FUNCTION IF EXISTS get_comprehensive_zcta_boundary(TEXT);

-- Ensure comprehensive_zip_codes has all required columns and constraints
ALTER TABLE comprehensive_zip_codes 
ADD COLUMN IF NOT EXISTS internal_lat NUMERIC,
ADD COLUMN IF NOT EXISTS internal_lng NUMERIC;

-- Create spatial indexes for performance
CREATE INDEX IF NOT EXISTS idx_comprehensive_zcta_polygons_geom ON comprehensive_zcta_polygons USING GIST(geom);
CREATE INDEX IF NOT EXISTS idx_comprehensive_zcta_polygons_zcta5ce ON comprehensive_zcta_polygons(zcta5ce);
CREATE INDEX IF NOT EXISTS idx_comprehensive_zip_codes_coords ON comprehensive_zip_codes(latitude, longitude) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_comprehensive_zip_codes_zipcode ON comprehensive_zip_codes(zipcode);
CREATE INDEX IF NOT EXISTS idx_comprehensive_zip_codes_state ON comprehensive_zip_codes(state_abbr);

-- Create comprehensive ZIP coverage function
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

-- Create batch ZIP coordinates function
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