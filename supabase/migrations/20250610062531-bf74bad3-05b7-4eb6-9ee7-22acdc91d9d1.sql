
-- Manually confirm the worker's email (only update email_confirmed_at)
UPDATE auth.users 
SET email_confirmed_at = NOW()
WHERE email = 'worker@tvmountpro.com';
