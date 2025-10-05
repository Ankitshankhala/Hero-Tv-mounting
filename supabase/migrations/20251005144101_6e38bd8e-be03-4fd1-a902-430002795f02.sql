-- Backfill payment_status: Change 'completed' to 'captured' for bookings
-- This fixes the inconsistency where bookings were marked as 'completed' after payment capture
-- Note: transactions.status remains 'completed' - only booking.payment_status changes

-- Log bookings that will be updated
INSERT INTO sms_logs (booking_id, recipient_number, message, status, error_message)
SELECT 
  id,
  'system',
  'Backfill: payment_status completed -> captured',
  'sent',
  NULL
FROM bookings 
WHERE payment_status = 'completed'
AND scheduled_date >= '2024-09-01';

-- Update bookings payment_status from 'completed' to 'captured'
UPDATE bookings 
SET payment_status = 'captured'
WHERE payment_status = 'completed'
AND scheduled_date >= '2024-09-01';

-- Return count of updated records
SELECT COUNT(*) as backfilled_count
FROM bookings 
WHERE payment_status = 'captured' 
AND scheduled_date >= '2024-09-01';