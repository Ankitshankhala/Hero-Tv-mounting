
-- Create admin user profile in the users table
INSERT INTO users (
  id,
  email,
  name,
  phone,
  city,
  region,
  role,
  is_active,
  created_at,
  updated_at
) VALUES (
  'f47ac10b-58cc-4372-a567-0e02b2c3d479'::uuid,
  'admin@tvmountpro.com',
  'Admin User',
  '+1234567890',
  'Los Angeles',
  'CA',
  'admin',
  true,
  NOW(),
  NOW()
) ON CONFLICT (id) DO UPDATE SET
  role = EXCLUDED.role,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();
