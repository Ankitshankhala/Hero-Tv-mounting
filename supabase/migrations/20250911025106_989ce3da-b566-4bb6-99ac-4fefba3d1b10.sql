-- Clean up and properly assign Connor's ZIP codes
-- First, delete all existing ZIP assignments for Connor
DELETE FROM worker_service_zipcodes 
WHERE worker_id = '3e2e7780-6abd-40f5-a5a2-70286b7496de';

-- Now insert the complete list of ZIP codes for Connor's North Austin MAP area
INSERT INTO worker_service_zipcodes (worker_id, service_area_id, zipcode)
SELECT 
  '3e2e7780-6abd-40f5-a5a2-70286b7496de'::uuid,
  '0c8b39e4-f52e-4b60-833a-08b86a1a8294'::uuid,
  zipcode
FROM (VALUES 
  ('78613'), ('78626'), ('78628'), ('78634'), ('78641'), ('78651'), ('78653'), 
  ('78660'), ('78664'), ('78665'), ('78681'), ('78717'), ('78723'), ('78724'), 
  ('78726'), ('78727'), ('78728'), ('78729'), ('78731'), ('78750'), ('78751'), 
  ('78752'), ('78753'), ('78754'), ('78757'), ('78758'), ('78759')
) AS zips(zipcode);

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
) VALUES (
  '3e2e7780-6abd-40f5-a5a2-70286b7496de'::uuid,
  '0c8b39e4-f52e-4b60-833a-08b86a1a8294'::uuid,
  'worker_service_zipcodes',
  'BULK_UPDATE',
  'North Austin MAP',
  'Cleaned up and assigned 27 ZIP codes to Connor''s North Austin MAP service area',
  jsonb_build_object('zipcodes_assigned', 27, 'zipcodes_list', ARRAY[
    '78613', '78626', '78628', '78634', '78641', '78651', '78653', 
    '78660', '78664', '78665', '78681', '78717', '78723', '78724', 
    '78726', '78727', '78728', '78729', '78731', '78750', '78751', 
    '78752', '78753', '78754', '78757', '78758', '78759'
  ]),
  '3e2e7780-6abd-40f5-a5a2-70286b7496de'::uuid
);