
-- Create a dummy worker user for testing
-- First, insert into auth.users table
INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  role,
  aud,
  confirmation_token,
  email_change_token_new,
  recovery_token,
  email_change,
  raw_app_meta_data,
  raw_user_meta_data
) VALUES (
  'a1b2c3d4-5678-90ab-cdef-123456789012'::uuid,
  '00000000-0000-0000-0000-000000000000'::uuid,
  'worker@test.com',
  crypt('worker123', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW(),
  'authenticated',
  'authenticated',
  '',
  '',
  '',
  '',
  '{"provider": "email", "providers": ["email"]}',
  '{"name": "Test Worker"}'
);

-- Insert corresponding identity record
INSERT INTO auth.identities (
  id,
  user_id,
  provider_id,
  identity_data,
  provider,
  created_at,
  updated_at
) VALUES (
  'a1b2c3d4-5678-90ab-cdef-123456789012'::uuid,
  'a1b2c3d4-5678-90ab-cdef-123456789012'::uuid,
  'worker@test.com',
  '{"sub": "a1b2c3d4-5678-90ab-cdef-123456789012", "email": "worker@test.com", "email_verified": true}',
  'email',
  NOW(),
  NOW()
);

-- Create the worker profile in the users table
INSERT INTO public.users (
  id,
  email,
  name,
  phone,
  city,
  zip_code,
  role,
  is_active
) VALUES (
  'a1b2c3d4-5678-90ab-cdef-123456789012'::uuid,
  'worker@test.com',
  'Test Worker',
  '+1-555-123-4567',
  'Los Angeles',
  '90210',
  'worker',
  true
);

-- Add some worker availability for testing
INSERT INTO public.worker_availability (
  worker_id,
  day_of_week,
  start_time,
  end_time
) VALUES 
  ('a1b2c3d4-5678-90ab-cdef-123456789012'::uuid, 'Monday', '09:00:00', '17:00:00'),
  ('a1b2c3d4-5678-90ab-cdef-123456789012'::uuid, 'Tuesday', '09:00:00', '17:00:00'),
  ('a1b2c3d4-5678-90ab-cdef-123456789012'::uuid, 'Wednesday', '09:00:00', '17:00:00'),
  ('a1b2c3d4-5678-90ab-cdef-123456789012'::uuid, 'Thursday', '09:00:00', '17:00:00'),
  ('a1b2c3d4-5678-90ab-cdef-123456789012'::uuid, 'Friday', '09:00:00', '17:00:00');
