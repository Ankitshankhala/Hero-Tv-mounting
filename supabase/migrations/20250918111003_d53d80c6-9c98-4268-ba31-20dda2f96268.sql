-- Phase 1: Optimize database performance with spatial indexes and materialized views
-- Create spatial indexes for better ZCTA performance
CREATE INDEX IF NOT EXISTS idx_zcta_polygons_geom ON us_zcta_polygons USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_zcta_polygons_zcta5ce ON us_zcta_polygons (zcta5ce);

-- Add index on zcta_zipcodes for fast lookup
CREATE INDEX IF NOT EXISTS idx_zcta_zipcodes_zcta_code ON zcta_zipcodes (zcta_code);

-- Create materialized view for frequently accessed ZIP coverage data
CREATE MATERIALIZED VIEW IF NOT EXISTS zip_coverage_summary AS
SELECT 
    wzz.zipcode,
    COUNT(DISTINCT wsa.worker_id) as worker_count,
    COUNT(DISTINCT wsa.id) as service_area_count,
    BOOL_OR(wsa.is_active) as has_active_coverage,
    ARRAY_AGG(DISTINCT wsa.worker_id) FILTER (WHERE wsa.is_active = true) as active_worker_ids
FROM worker_service_zipcodes wzz
JOIN worker_service_areas wsa ON wzz.service_area_id = wsa.id
JOIN users u ON wsa.worker_id = u.id AND u.role = 'worker' AND u.is_active = true
GROUP BY wzz.zipcode;

-- Create unique index on the materialized view for fast lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_zip_coverage_summary_zipcode ON zip_coverage_summary (zipcode);

-- Function to refresh the materialized view
CREATE OR REPLACE FUNCTION refresh_zip_coverage_summary()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW zip_coverage_summary;
END;
$$;

-- Enhanced function for direct ZIP coverage checking
CREATE OR REPLACE FUNCTION get_zip_coverage_info(p_zipcode text)
RETURNS TABLE(
    has_coverage boolean,
    worker_count integer,
    active_workers uuid[]
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(zcs.has_active_coverage, false) as has_coverage,
        COALESCE(zcs.worker_count, 0) as worker_count,
        COALESCE(zcs.active_worker_ids, ARRAY[]::uuid[]) as active_workers
    FROM zip_coverage_summary zcs
    WHERE zcs.zipcode = p_zipcode;
    
    -- If no result found, return default values
    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 0, ARRAY[]::uuid[];
    END IF;
END;
$$;