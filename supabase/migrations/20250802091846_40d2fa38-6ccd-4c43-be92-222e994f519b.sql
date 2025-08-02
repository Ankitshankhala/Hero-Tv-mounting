-- Clean up bookings with test payment intents that cannot be processed with live keys
-- These bookings have payment_pending status with test payment intents (pi_3..._test_...)

DELETE FROM booking_services 
WHERE booking_id IN (
  SELECT id FROM bookings 
  WHERE status = 'payment_pending' 
  AND payment_intent_id LIKE 'pi_%CrUPkotWKC%'
  AND payment_intent_id NOT LIKE '%live%'
);

DELETE FROM transactions 
WHERE booking_id IN (
  SELECT id FROM bookings 
  WHERE status = 'payment_pending' 
  AND payment_intent_id LIKE 'pi_%CrUPkotWKC%'
  AND payment_intent_id NOT LIKE '%live%'
);

DELETE FROM bookings 
WHERE status = 'payment_pending' 
AND payment_intent_id LIKE 'pi_%CrUPkotWKC%'
AND payment_intent_id NOT LIKE '%live%';

-- Log the cleanup for audit purposes
INSERT INTO sms_logs (booking_id, recipient_number, message, status, error_message)
VALUES (NULL, 'system', 'Cleaned up test payment intent bookings for live mode switch', 'sent', NULL);