
-- First, add a unique constraint to prevent duplicate availability entries
ALTER TABLE public.worker_availability 
ADD CONSTRAINT worker_availability_worker_day_unique 
UNIQUE (worker_id, day_of_week);

-- Check if the worker profile exists and update it if needed
UPDATE public.users 
SET 
  name = 'Test Worker',
  phone = '555-0123',
  city = 'Austin',
  region = 'Central Texas',
  role = 'worker'
WHERE id = 'b50c0f9c-554f-4cfd-9532-5876726806c3'::uuid;

-- Delete any existing availability for this worker to avoid conflicts
DELETE FROM public.worker_availability 
WHERE worker_id = 'b50c0f9c-554f-4cfd-9532-5876726806c3'::uuid;

-- Insert worker availability (Monday to Friday, 9 AM to 5 PM)
INSERT INTO public.worker_availability (
  worker_id,
  day_of_week,
  start_time,
  end_time,
  is_active
) VALUES 
  ('b50c0f9c-554f-4cfd-9532-5876726806c3'::uuid, 1, '09:00:00', '17:00:00', true),
  ('b50c0f9c-554f-4cfd-9532-5876726806c3'::uuid, 2, '09:00:00', '17:00:00', true),
  ('b50c0f9c-554f-4cfd-9532-5876726806c3'::uuid, 3, '09:00:00', '17:00:00', true),
  ('b50c0f9c-554f-4cfd-9532-5876726806c3'::uuid, 4, '09:00:00', '17:00:00', true),
  ('b50c0f9c-554f-4cfd-9532-5876726806c3'::uuid, 5, '09:00:00', '17:00:00', true);
