
-- First, let's ensure we have some basic services (only insert if none exist)
INSERT INTO public.services (id, name, description, base_price, duration_minutes, is_active, is_visible, sort_order)
SELECT gen_random_uuid(), 'TV Wall Mounting', 'Professional TV wall mounting service with cable management', 150.00, 120, true, true, 1
WHERE NOT EXISTS (SELECT 1 FROM public.services WHERE name = 'TV Wall Mounting');

INSERT INTO public.services (id, name, description, base_price, duration_minutes, is_active, is_visible, sort_order)
SELECT gen_random_uuid(), 'TV Setup & Configuration', 'Complete TV setup including streaming services and sound system', 100.00, 90, true, true, 2
WHERE NOT EXISTS (SELECT 1 FROM public.services WHERE name = 'TV Setup & Configuration');

INSERT INTO public.services (id, name, description, base_price, duration_minutes, is_active, is_visible, sort_order)
SELECT gen_random_uuid(), 'Cable Management', 'Hide and organize all TV and entertainment system cables', 75.00, 60, true, true, 3
WHERE NOT EXISTS (SELECT 1 FROM public.services WHERE name = 'Cable Management');

INSERT INTO public.services (id, name, description, base_price, duration_minutes, is_active, is_visible, sort_order)
SELECT gen_random_uuid(), 'Sound System Installation', 'Install and configure home theater sound system', 200.00, 150, true, true, 4
WHERE NOT EXISTS (SELECT 1 FROM public.services WHERE name = 'Sound System Installation');

INSERT INTO public.services (id, name, description, base_price, duration_minutes, is_active, is_visible, sort_order)
SELECT gen_random_uuid(), 'Smart Home Integration', 'Connect TV to smart home ecosystem', 125.00, 90, true, true, 5
WHERE NOT EXISTS (SELECT 1 FROM public.services WHERE name = 'Smart Home Integration');

-- Create a sample admin user if one doesn't exist
INSERT INTO public.users (id, email, name, phone, role, is_active, city, zip_code)
SELECT 'f47ac10b-58cc-4372-a567-0e02b2c3d479', 'admin@tvmountpro.com', 'Admin User', '+1234567890', 'admin', true, 'New York', '10001'
WHERE NOT EXISTS (SELECT 1 FROM public.users WHERE email = 'admin@tvmountpro.com');

-- Create some sample workers if none exist
INSERT INTO public.users (id, email, name, phone, role, is_active, city, zip_code, latitude, longitude)
SELECT gen_random_uuid(), 'worker1@tvmountpro.com', 'John Smith', '+1234567891', 'worker', true, 'New York', '10001', 40.7128, -74.0060
WHERE NOT EXISTS (SELECT 1 FROM public.users WHERE email = 'worker1@tvmountpro.com');

INSERT INTO public.users (id, email, name, phone, role, is_active, city, zip_code, latitude, longitude)
SELECT gen_random_uuid(), 'worker2@tvmountpro.com', 'Mike Johnson', '+1234567892', 'worker', true, 'Brooklyn', '11201', 40.6892, -73.9442
WHERE NOT EXISTS (SELECT 1 FROM public.users WHERE email = 'worker2@tvmountpro.com');

INSERT INTO public.users (id, email, name, phone, role, is_active, city, zip_code, latitude, longitude)
SELECT gen_random_uuid(), 'worker3@tvmountpro.com', 'David Wilson', '+1234567893', 'worker', true, 'Queens', '11101', 40.7282, -73.9442
WHERE NOT EXISTS (SELECT 1 FROM public.users WHERE email = 'worker3@tvmountpro.com');

-- Set up basic worker availability for all workers (Monday to Friday, 9 AM to 6 PM)
INSERT INTO public.worker_availability (worker_id, day_of_week, start_time, end_time)
SELECT 
  w.id,
  day_name::day_of_week,
  '09:00'::time,
  '18:00'::time
FROM (SELECT id FROM public.users WHERE role = 'worker' AND is_active = true) w
CROSS JOIN (
  SELECT unnest(ARRAY['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']) as day_name
) days
WHERE NOT EXISTS (
  SELECT 1 FROM public.worker_availability wa 
  WHERE wa.worker_id = w.id AND wa.day_of_week = day_name::day_of_week
);

-- Create a sample customer if none exist
INSERT INTO public.users (id, email, name, phone, role, is_active, city, zip_code)
SELECT gen_random_uuid(), 'customer@example.com', 'Sample Customer', '+1234567894', 'customer', true, 'Manhattan', '10001'
WHERE NOT EXISTS (SELECT 1 FROM public.users WHERE email = 'customer@example.com');
