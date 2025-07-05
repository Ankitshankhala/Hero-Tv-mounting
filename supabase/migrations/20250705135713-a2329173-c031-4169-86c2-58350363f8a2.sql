-- Update admin credentials from admin@tvmountpro.com to admin@herotvmounting.com
-- This migration safely updates all references to the admin user

-- Update the auth.users table with new email and password
UPDATE auth.users 
SET 
  email = 'admin@herotvmounting.com',
  encrypted_password = crypt('Impervious96!!', gen_salt('bf'))
WHERE id = 'f47ac10b-58cc-4372-a567-0e02b2c3d479'::uuid;

-- Update the auth.identities table with new email
UPDATE auth.identities
SET 
  provider_id = 'admin@herotvmounting.com',
  identity_data = jsonb_set(
    identity_data, 
    '{email}', 
    '"admin@herotvmounting.com"'
  )
WHERE user_id = 'f47ac10b-58cc-4372-a567-0e02b2c3d479'::uuid;

-- Update the public.users table with new email
UPDATE public.users
SET 
  email = 'admin@herotvmounting.com'
WHERE id = 'f47ac10b-58cc-4372-a567-0e02b2c3d479'::uuid;

-- Update the RLS policy to reference the new admin email
DROP POLICY IF EXISTS "Direct admin access" ON public.users;
CREATE POLICY "Direct admin access" ON public.users
FOR ALL USING (
  (auth.jwt() ->> 'email'::text) = 'admin@herotvmounting.com'::text
);