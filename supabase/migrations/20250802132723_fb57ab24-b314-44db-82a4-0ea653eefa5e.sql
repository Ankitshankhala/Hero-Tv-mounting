-- Clean database by removing all booking-related data
-- Delete in correct order to avoid foreign key constraint errors

-- 1. Delete dependent records first
DELETE FROM public.booking_service_modifications;
DELETE FROM public.invoice_service_modifications;
DELETE FROM public.invoice_items;
DELETE FROM public.invoices;
DELETE FROM public.manual_charges;
DELETE FROM public.onsite_charges;
DELETE FROM public.worker_coverage_notifications;
DELETE FROM public.worker_bookings;
DELETE FROM public.booking_services;
DELETE FROM public.transactions;
DELETE FROM public.payment_sessions;
DELETE FROM public.email_logs WHERE booking_id IS NOT NULL;
DELETE FROM public.sms_logs WHERE booking_id IS NOT NULL;

-- 2. Delete main bookings table
DELETE FROM public.bookings;

-- 3. Clean up audit logs
DELETE FROM public.booking_audit_log;

-- 4. Clean up any orphaned records
DELETE FROM public.reviews;
DELETE FROM public.idempotency_records;