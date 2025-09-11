-- Clean up any orphaned ZIP code entries for Connor and properly assign them to his active area
-- First, get Connor's active service area
WITH connor_active_area AS (
  SELECT id 
  FROM worker_service_areas 
  WHERE worker_id = '3e2e7780-6abd-40f5-a5a2-70286b7496de' 
  AND is_active = true 
  AND area_name = 'North Austin MAP'
  LIMIT 1
),
-- Delete any existing ZIP assignments that might be causing issues
cleanup AS (
  DELETE FROM worker_service_zipcodes 
  WHERE worker_id = '3e2e7780-6abd-40f5-a5a2-70286b7496de'
  RETURNING zipcode
),
-- Insert the correct ZIP assignments
zip_data AS (
  SELECT unnest(ARRAY[
    '78613', '78626', '78628', '78634', '78641', '78651', '78653', 
    '78660', '78664', '78665', '78681', '78717', '78723', '78724', 
    '78726', '78727', '78728', '78729', '78731', '78750', '78751', 
    '78752', '78753', '78754', '78757', '78758', '78759'
  ]) AS zipcode
)
INSERT INTO worker_service_zipcodes (worker_id, service_area_id, zipcode)
SELECT 
  '3e2e7780-6abd-40f5-a5a2-70286b7496de'::uuid,
  caa.id,
  zd.zipcode
FROM connor_active_area caa
CROSS JOIN zip_data zd;

-- Log the audit entry
INSERT INTO service_area_audit_logs (
  worker_id, 
  record_id, 
  table_name, 
  operation, 
  area_name,
  change_summary,
  new_data,
  changed_by
) 
SELECT 
  '3e2e7780-6abd-40f5-a5a2-70286b7496de'::uuid,
  caa.id,
  'worker_service_zipcodes',
  'BULK_INSERT',
  'North Austin MAP',
  'Assigned 27 ZIP codes to Connor''s North Austin MAP service area',
  jsonb_build_object('zipcodes_assigned', 27),
  '3e2e7780-6abd-40f5-a5a2-70286b7496de'::uuid
FROM connor_active_area caa;