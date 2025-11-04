-- Fix Taylor Veydt booking tip allocation
-- Issue: Tip was recorded as $100 instead of $20, base amount as $0 instead of $80
-- Booking ID: 74228610-3c33-4167-8336-e3f558fdba81
-- Transaction ID: c3049685-ddea-4068-854e-6ae9e8cbcb62

-- Update transaction amounts
UPDATE transactions
SET 
  base_amount = 80,
  tip_amount = 20
WHERE id = 'c3049685-ddea-4068-854e-6ae9e8cbcb62'
  AND booking_id = '74228610-3c33-4167-8336-e3f558fdba81';

-- Update booking tip amount
UPDATE bookings
SET tip_amount = 20
WHERE id = '74228610-3c33-4167-8336-e3f558fdba81';

-- Log the correction
INSERT INTO booking_audit_log (
  booking_id,
  operation,
  status,
  details
) VALUES (
  '74228610-3c33-4167-8336-e3f558fdba81',
  'manual_correction',
  'completed',
  jsonb_build_object(
    'reason', 'Corrected tip/service amount split - tip was $100 should be $20, base was $0 should be $80',
    'old_values', jsonb_build_object('tip_amount', 100, 'base_amount', 0),
    'new_values', jsonb_build_object('tip_amount', 20, 'base_amount', 80),
    'total_amount', 100,
    'corrected_at', now()
  )
);