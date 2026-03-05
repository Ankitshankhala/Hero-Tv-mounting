ALTER TABLE worker_service_zipcodes
ADD CONSTRAINT worker_service_zipcodes_worker_id_fkey
FOREIGN KEY (worker_id) REFERENCES users(id) ON DELETE CASCADE;