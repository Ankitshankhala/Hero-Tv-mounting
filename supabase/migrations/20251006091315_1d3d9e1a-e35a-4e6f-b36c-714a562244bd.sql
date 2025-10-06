-- Fix ZCTA coordinate system mismatch
-- Transform all ZCTA geometries from Web Mercator (EPSG:3857) to WGS84 (EPSG:4326)

-- Update geometries that are mislabeled as 4326 but actually contain 3857 coordinates
UPDATE us_zcta_polygons 
SET geom = ST_Transform(ST_SetSRID(geom, 3857), 4326)
WHERE ST_SRID(geom) = 4326
  AND ST_XMax(geom) > 180; -- Detect Web Mercator coordinates (exceed WGS84 bounds)

-- Create spatial index if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_zcta_geom ON us_zcta_polygons USING GIST (geom);

-- Analyze table for query optimization
ANALYZE us_zcta_polygons;