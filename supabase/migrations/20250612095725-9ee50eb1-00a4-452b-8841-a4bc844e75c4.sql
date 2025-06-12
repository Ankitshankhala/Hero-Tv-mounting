
-- Clear demo booking data and related records
DELETE FROM public.payment_sessions;
DELETE FROM public.transactions;
DELETE FROM public.on_site_charges;
DELETE FROM public.invoice_modifications;
DELETE FROM public.notifications;
DELETE FROM public.sms_logs;
DELETE FROM public.bookings;

-- Clear worker-related data
DELETE FROM public.worker_schedules;
DELETE FROM public.worker_availability;
DELETE FROM public.worker_applications;

-- Clear customer/user data (keeping only admin users)
DELETE FROM public.users WHERE role != 'admin';

-- Reset any sequences if needed
-- Note: UUIDs don't use sequences, so this isn't necessary for this schema
