-- Delete customer users only, preserve admin and worker accounts

-- Delete users with role 'customer'
DELETE FROM public.users WHERE role = 'customer';