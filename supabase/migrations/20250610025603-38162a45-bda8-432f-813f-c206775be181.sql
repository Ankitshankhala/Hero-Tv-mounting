
-- Insert admin user into auth.users table with default password
-- This creates the authentication record for the admin user
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
  recovery_token
) VALUES (
  'f47ac10b-58cc-4372-a567-0e02b2c3d479'::uuid,
  '00000000-0000-0000-0000-000000000000'::uuid,
  'admin@tvmountpro.com',
  crypt('admin123', gen_salt('bf')), -- Default password: admin123
  NOW(),
  NOW(),
  NOW(),
  'authenticated',
  'authenticated',
  '',
  '',
  ''
) ON CONFLICT (id) DO NOTHING;

-- Insert corresponding identity record
INSERT INTO auth.identities (
  id,
  user_id,
  provider_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
) VALUES (
  'f47ac10b-58cc-4372-a567-0e02b2c3d479'::uuid,
  'f47ac10b-58cc-4372-a567-0e02b2c3d479'::uuid,
  'admin@tvmountpro.com',
  '{"sub": "f47ac10b-58cc-4372-a567-0e02b2c3d479", "email": "admin@tvmountpro.com"}'::jsonb,
  'email',
  NOW(),
  NOW(),
  NOW()
) ON CONFLICT (provider_id, provider) DO NOTHING;
