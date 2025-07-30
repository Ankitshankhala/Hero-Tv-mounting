-- Complete booking database cleanup - removes all booking data and related records

-- Delete worker coverage notifications
DELETE FROM worker_coverage_notifications;

-- Delete booking service modifications
DELETE FROM booking_service_modifications;

-- Delete invoice service modifications
DELETE FROM invoice_service_modifications;

-- Delete manual charges
DELETE FROM manual_charges;

-- Delete onsite charges
DELETE FROM onsite_charges;

-- Delete reviews
DELETE FROM reviews;

-- Delete invoice items
DELETE FROM invoice_items;

-- Delete invoices
DELETE FROM invoices;

-- Delete worker bookings
DELETE FROM worker_bookings;

-- Delete booking services
DELETE FROM booking_services;

-- Delete transactions
DELETE FROM transactions;

-- Delete payment sessions
DELETE FROM payment_sessions;

-- Delete booking-related SMS logs
DELETE FROM sms_logs WHERE booking_id IS NOT NULL;

-- Delete booking-related email logs
DELETE FROM email_logs WHERE booking_id IS NOT NULL;

-- Delete booking audit logs
DELETE FROM booking_audit_log;

-- Finally, delete all bookings
DELETE FROM bookings;

-- Reset sequences if any exist
-- Note: Most tables use uuid_generate_v4() so no sequence reset needed

-- Vacuum tables for optimal performance
VACUUM ANALYZE bookings;
VACUUM ANALYZE booking_services;
VACUUM ANALYZE transactions;
VACUUM ANALYZE invoices;
VACUUM ANALYZE worker_bookings;