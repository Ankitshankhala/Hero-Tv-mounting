-- Remove hardcoded test workers from the system
-- These are test workers with systematic email addresses that should not be in production

-- First, let's see what test workers exist
-- We'll remove workers with obvious test email patterns like worker1@, worker2@, etc.

-- Remove test workers and any related data
DELETE FROM public.worker_availability 
WHERE worker_id IN (
  SELECT id FROM public.users 
  WHERE email LIKE 'worker%@tvmountpro.com' 
  AND email ~ '^worker[0-9]+@tvmountpro\.com$'
);

DELETE FROM public.worker_schedule 
WHERE worker_id IN (
  SELECT id FROM public.users 
  WHERE email LIKE 'worker%@tvmountpro.com' 
  AND email ~ '^worker[0-9]+@tvmountpro\.com$'
);

DELETE FROM public.worker_bookings 
WHERE worker_id IN (
  SELECT id FROM public.users 
  WHERE email LIKE 'worker%@tvmountpro.com' 
  AND email ~ '^worker[0-9]+@tvmountpro\.com$'
);

DELETE FROM public.worker_notifications 
WHERE worker_id IN (
  SELECT id FROM public.users 
  WHERE email LIKE 'worker%@tvmountpro.com' 
  AND email ~ '^worker[0-9]+@tvmountpro\.com$'
);

-- Finally, remove the test worker users themselves
DELETE FROM public.users 
WHERE email LIKE 'worker%@tvmountpro.com' 
AND email ~ '^worker[0-9]+@tvmountpro\.com$';