-- Complete ZCTA data consolidation by removing redundant zcta_zipcodes table
-- All functionality now uses us_zcta_polygons directly

DROP TABLE IF EXISTS zcta_zipcodes CASCADE;

-- Verify the consolidation worked
SELECT 
  'us_zcta_polygons' as table_name, 
  COUNT(*) as record_count,
  'ZCTA polygons for spatial intersection' as purpose
FROM us_zcta_polygons
UNION ALL
SELECT 
  'us_zip_codes' as table_name,
  COUNT(*) as record_count, 
  'ZIP code coordinates and location data' as purpose
FROM us_zip_codes;