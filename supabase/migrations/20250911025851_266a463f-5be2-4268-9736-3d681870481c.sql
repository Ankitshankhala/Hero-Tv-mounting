-- Assign ZIP codes to Henry Griffith's South Austin service area
-- First, delete any existing ZIP assignments for Henry to avoid duplicates
DELETE FROM worker_service_zipcodes 
WHERE worker_id = '84cfc1c3-f2e8-4a3d-8977-061e5639a4c9';

-- Now insert the complete list of South Austin ZIP codes for Henry
INSERT INTO worker_service_zipcodes (worker_id, service_area_id, zipcode)
SELECT 
  '84cfc1c3-f2e8-4a3d-8977-061e5639a4c9'::uuid,
  '0e5fb607-cb9f-4874-a7f8-1756a29747d9'::uuid,
  zipcode
FROM (VALUES 
  ('78652'), ('78701'), ('78702'), ('78703'), ('78704'), ('78705'), ('78712'), ('78719'), 
  ('78721'), ('78722'), ('78723'), ('78724'), ('78730'), ('78731'), ('78732'), ('78733'), 
  ('78735'), ('78736'), ('78737'), ('78738'), ('78739'), ('78741'), ('78742'), ('78744'), 
  ('78745'), ('78746'), ('78747'), ('78748'), ('78749'), ('78750')
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
  '84cfc1c3-f2e8-4a3d-8977-061e5639a4c9'::uuid,
  '0e5fb607-cb9f-4874-a7f8-1756a29747d9'::uuid,
  'worker_service_zipcodes',
  'BULK_UPDATE',
  'South Austin MAP',
  'Assigned 30 ZIP codes to Henry Griffith''s South Austin MAP service area',
  jsonb_build_object('zipcodes_assigned', 30, 'zipcodes_list', ARRAY[
    '78652', '78701', '78702', '78703', '78704', '78705', '78712', '78719', 
    '78721', '78722', '78723', '78724', '78730', '78731', '78732', '78733', 
    '78735', '78736', '78737', '78738', '78739', '78741', '78742', '78744', 
    '78745', '78746', '78747', '78748', '78749', '78750'
  ]),
  '84cfc1c3-f2e8-4a3d-8977-061e5639a4c9'::uuid
);