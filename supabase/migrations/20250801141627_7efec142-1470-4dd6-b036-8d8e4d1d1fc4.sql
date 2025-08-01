-- Delete all booking-related data in the correct order to avoid foreign key constraints

-- Delete related records first
DELETE FROM worker_coverage_notifications;
DELETE FROM booking_audit_log;
DELETE FROM invoice_service_modifications;
DELETE FROM email_logs WHERE booking_id IS NOT NULL;
DELETE FROM sms_logs WHERE booking_id IS NOT NULL;
DELETE FROM onsite_charges;
DELETE FROM manual_charges;
DELETE FROM invoice_items WHERE invoice_id IN (SELECT id FROM invoices);
DELETE FROM invoices;
DELETE FROM reviews;
DELETE FROM transactions;
DELETE FROM worker_bookings;
DELETE FROM booking_service_modifications;
DELETE FROM booking_services;

-- Finally delete all bookings
DELETE FROM bookings;