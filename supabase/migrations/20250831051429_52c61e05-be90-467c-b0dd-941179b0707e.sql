-- First, create missing transaction records for captured bookings without transactions
INSERT INTO transactions (booking_id, amount, status, transaction_type, payment_method, currency)
SELECT 
  b.id as booking_id,
  -- Calculate total amount from booking services
  COALESCE((
    SELECT SUM(bs.base_price * bs.quantity) 
    FROM booking_services bs 
    WHERE bs.booking_id = b.id
  ), 100) as amount,
  'completed' as status,
  'capture' as transaction_type,
  'card' as payment_method,
  'USD' as currency
FROM bookings b
WHERE b.payment_status = 'captured' 
  AND b.status = 'confirmed'
  AND NOT EXISTS (
    SELECT 1 FROM transactions t WHERE t.booking_id = b.id
  );

-- Now update these bookings to completed status
UPDATE bookings 
SET status = 'completed', payment_status = 'completed'
WHERE payment_status = 'captured' 
  AND status = 'confirmed'
  AND (is_archived IS FALSE OR is_archived IS NULL);

-- Archive the completed bookings
UPDATE bookings 
SET is_archived = true, archived_at = now()
WHERE status = 'completed' 
  AND payment_status = 'completed'
  AND (is_archived IS FALSE OR is_archived IS NULL);