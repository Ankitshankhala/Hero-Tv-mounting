-- Delete all related data first, then bookings
DELETE FROM public.sms_logs;
DELETE FROM public.email_logs;
DELETE FROM public.transactions;
DELETE FROM public.booking_services;
DELETE FROM public.worker_bookings;
DELETE FROM public.worker_coverage_notifications;
DELETE FROM public.booking_service_modifications;
DELETE FROM public.invoice_service_modifications;
DELETE FROM public.manual_charges;
DELETE FROM public.onsite_charges;
DELETE FROM public.invoice_items;
DELETE FROM public.invoices;
DELETE FROM public.reviews;
DELETE FROM public.booking_audit_log;
DELETE FROM public.bookings;