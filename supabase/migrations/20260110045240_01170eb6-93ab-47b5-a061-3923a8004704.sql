-- Add foreign key constraint for worker_id to enable proper PostgREST relations
ALTER TABLE bookings
ADD CONSTRAINT fk_bookings_worker_id 
FOREIGN KEY (worker_id) 
REFERENCES users(id) 
ON DELETE SET NULL;