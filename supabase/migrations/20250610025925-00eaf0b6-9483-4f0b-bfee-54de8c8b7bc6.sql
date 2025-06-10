
-- First, let's clean up any existing problematic admin user records
DELETE FROM auth.identities WHERE user_id = 'f47ac10b-58cc-4372-a567-0e02b2c3d479'::uuid;
DELETE FROM auth.users WHERE id = 'f47ac10b-58cc-4372-a567-0e02b2c3d479'::uuid;

-- Insert admin user into auth.users table with only the essential fields (excluding generated columns)
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
  'f47ac10b-58cc-4372-a567-0e02b2c3d479'::uuid,
  '00000000-0000-0000-0000-000000000000'::uuid,
  'admin@tvmountpro.com',
  crypt('admin123', gen_salt('bf')),
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
  '{"name": "Admin User"}'
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
  'f47ac10b-58cc-4372-a567-0e02b2c3d479'::uuid,
  'f47ac10b-58cc-4372-a567-0e02b2c3d479'::uuid,
  'admin@tvmountpro.com',
  '{"sub": "f47ac10b-58cc-4372-a567-0e02b2c3d479", "email": "admin@tvmountpro.com", "email_verified": true}',
  'email',
  NOW(),
  NOW()
);
