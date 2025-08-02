-- Delete all booking-related data
-- Note: This will permanently delete ALL bookings and related data

-- Delete dependent records first to avoid foreign key constraint violations

-- Delete booking audit logs
DELETE FROM public.booking_audit_log WHERE booking_id IS NOT NULL;

-- Delete booking service modifications
DELETE FROM public.booking_service_modifications;

-- Delete booking services
DELETE FROM public.booking_services;

-- Delete email logs related to bookings
DELETE FROM public.email_logs WHERE booking_id IS NOT NULL;

-- Delete invoice items (via invoices that reference bookings)
DELETE FROM public.invoice_items 
WHERE invoice_id IN (
  SELECT id FROM public.invoices WHERE booking_id IS NOT NULL
);

-- Delete invoices related to bookings
DELETE FROM public.invoices WHERE booking_id IS NOT NULL;

-- Delete manual charges
DELETE FROM public.manual_charges;

-- Delete onsite charges
DELETE FROM public.onsite_charges;

-- Delete reviews
DELETE FROM public.reviews;

-- Delete SMS logs related to bookings
DELETE FROM public.sms_logs WHERE booking_id IS NOT NULL;

-- Delete payment sessions (via transactions)
DELETE FROM public.payment_sessions 
WHERE transaction_id IN (
  SELECT id FROM public.transactions WHERE booking_id IS NOT NULL
);

-- Delete transactions
DELETE FROM public.transactions WHERE booking_id IS NOT NULL;

-- Delete worker bookings
DELETE FROM public.worker_bookings;

-- Delete worker coverage notifications
DELETE FROM public.worker_coverage_notifications;

-- Finally, delete all bookings
DELETE FROM public.bookings;

-- Log the cleanup operation
INSERT INTO public.sms_logs (booking_id, recipient_number, message, status, error_message)
VALUES (NULL, 'system', 'All bookings and related data deleted by admin', 'sent', NULL);