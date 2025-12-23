-- Repair historical transactions with missing base_amount/tip_amount
-- This fixes transactions where amount > 0 but base_amount is missing/zero

UPDATE transactions t
SET 
  base_amount = COALESCE(
    (SELECT SUM(bs.base_price * bs.quantity) 
     FROM booking_services bs 
     WHERE bs.booking_id = t.booking_id),
    t.amount - COALESCE(t.tip_amount, 0)
  ),
  tip_amount = COALESCE(
    t.tip_amount,
    (SELECT b.tip_amount FROM bookings b WHERE b.id = t.booking_id),
    0
  )
WHERE t.booking_id IS NOT NULL
  AND t.amount > 0
  AND (t.base_amount IS NULL OR t.base_amount = 0);