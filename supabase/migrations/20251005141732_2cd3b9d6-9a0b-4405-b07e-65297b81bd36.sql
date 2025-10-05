-- Fix September/October bookings incorrectly marked as completed after payment capture
-- These should be 'confirmed' (payment captured, job not yet done)

UPDATE bookings 
SET 
  status = 'confirmed',
  updated_at = now()
WHERE 
  status = 'completed'
  AND payment_status IN ('captured', 'completed', 'authorized')
  AND created_at >= '2024-09-01'
  AND NOT EXISTS (
    -- Don't change if worker actually marked it completed
    SELECT 1 FROM worker_bookings wb 
    WHERE wb.booking_id = bookings.id 
    AND wb.status = 'completed'
  );

-- Log the correction
INSERT INTO sms_logs (booking_id, recipient_number, message, status, error_message)
SELECT 
  id,
  'system',
  'Corrected booking status from completed to confirmed (payment captured, job pending)',
  'sent',
  NULL
FROM bookings
WHERE 
  status = 'confirmed'
  AND payment_status IN ('captured', 'completed', 'authorized')
  AND created_at >= '2024-09-01'
  AND updated_at > now() - interval '10 seconds';