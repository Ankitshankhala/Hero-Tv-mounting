
-- Clear stale stripe customers (from old account/mode)
DELETE FROM stripe_customers;

-- Clear stale stripe references on pending/unprocessed bookings
UPDATE bookings
SET stripe_customer_id = NULL, stripe_payment_method_id = NULL
WHERE payment_status IN ('pending', 'payment_pending');

-- Clear stale stripe references on users table
UPDATE users
SET stripe_customer_id = NULL, stripe_default_payment_method_id = NULL, has_saved_card = FALSE;
