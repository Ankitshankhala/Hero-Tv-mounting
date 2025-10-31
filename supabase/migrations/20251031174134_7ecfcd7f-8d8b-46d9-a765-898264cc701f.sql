-- Phase 4: Add default worker availability schedules for both workers
-- This enables both automatic and manual worker assignment to function properly

-- Add 7-day availability (Mon-Sun, 8 AM - 8 PM) for ANKIT SHANKHALA (New York worker)
INSERT INTO worker_availability (worker_id, day_of_week, start_time, end_time)
VALUES 
  ('1d6b0847-7e4c-454a-be20-9a843e9b6df3', 'Monday', '08:00:00', '20:00:00'),
  ('1d6b0847-7e4c-454a-be20-9a843e9b6df3', 'Tuesday', '08:00:00', '20:00:00'),
  ('1d6b0847-7e4c-454a-be20-9a843e9b6df3', 'Wednesday', '08:00:00', '20:00:00'),
  ('1d6b0847-7e4c-454a-be20-9a843e9b6df3', 'Thursday', '08:00:00', '20:00:00'),
  ('1d6b0847-7e4c-454a-be20-9a843e9b6df3', 'Friday', '08:00:00', '20:00:00'),
  ('1d6b0847-7e4c-454a-be20-9a843e9b6df3', 'Saturday', '08:00:00', '20:00:00'),
  ('1d6b0847-7e4c-454a-be20-9a843e9b6df3', 'Sunday', '08:00:00', '20:00:00')
ON CONFLICT DO NOTHING;

-- Add 7-day availability (Mon-Sun, 8 AM - 8 PM) for Michael Davison (Kansas City worker)
INSERT INTO worker_availability (worker_id, day_of_week, start_time, end_time)
VALUES 
  ('187dd38f-42e9-49aa-96e2-f87c46d4168c', 'Monday', '08:00:00', '20:00:00'),
  ('187dd38f-42e9-49aa-96e2-f87c46d4168c', 'Tuesday', '08:00:00', '20:00:00'),
  ('187dd38f-42e9-49aa-96e2-f87c46d4168c', 'Wednesday', '08:00:00', '20:00:00'),
  ('187dd38f-42e9-49aa-96e2-f87c46d4168c', 'Thursday', '08:00:00', '20:00:00'),
  ('187dd38f-42e9-49aa-96e2-f87c46d4168c', 'Friday', '08:00:00', '20:00:00'),
  ('187dd38f-42e9-49aa-96e2-f87c46d4168c', 'Saturday', '08:00:00', '20:00:00'),
  ('187dd38f-42e9-49aa-96e2-f87c46d4168c', 'Sunday', '08:00:00', '20:00:00')
ON CONFLICT DO NOTHING;