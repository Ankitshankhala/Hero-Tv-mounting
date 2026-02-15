
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_version integer NOT NULL DEFAULT 1;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS authorized_amount numeric;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS captured_amount numeric;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS last_payment_intent_id text;

CREATE OR REPLACE FUNCTION lock_booking_for_payment(p_booking_id uuid)
RETURNS TABLE(
  id uuid, payment_intent_id text, stripe_customer_id text,
  stripe_payment_method_id text, tip_amount numeric, payment_status text,
  payment_version integer, authorized_amount numeric, captured_amount numeric,
  last_payment_intent_id text
) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT b.id, b.payment_intent_id, b.stripe_customer_id,
         b.stripe_payment_method_id, b.tip_amount, b.payment_status::text,
         b.payment_version, b.authorized_amount, b.captured_amount,
         b.last_payment_intent_id
  FROM bookings b WHERE b.id = p_booking_id
  FOR UPDATE NOWAIT;
EXCEPTION
  WHEN lock_not_available THEN
    RAISE EXCEPTION 'Booking is currently being modified. Please try again.';
END;
$$;
