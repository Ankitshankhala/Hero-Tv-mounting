
-- Update the admin user's password to "Admin1230"
UPDATE auth.users 
SET encrypted_password = crypt('Admin1230', gen_salt('bf'))
WHERE id = 'f47ac10b-58cc-4372-a567-0e02b2c3d479'::uuid;
