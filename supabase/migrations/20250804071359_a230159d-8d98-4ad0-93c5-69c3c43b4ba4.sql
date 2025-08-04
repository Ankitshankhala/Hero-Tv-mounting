-- Remove test bookings and related data safely
-- First delete SMS logs for test bookings
DELETE FROM sms_logs 
WHERE booking_id IN (
  SELECT id FROM bookings 
  WHERE 
    -- Test bookings with guest customer info containing test data
    (guest_customer_info->>'email' LIKE '%test%' 
     OR guest_customer_info->>'name' LIKE '%Test%'
     OR guest_customer_info->>'email' = 'customer@test.com')
    -- OR test payment intent IDs
    OR payment_intent_id LIKE 'pi_test_%'
    OR payment_intent_id LIKE 'test_%'
);

-- Then delete the test bookings
DELETE FROM bookings 
WHERE 
  -- Test bookings with guest customer info containing test data
  (guest_customer_info->>'email' LIKE '%test%' 
   OR guest_customer_info->>'name' LIKE '%Test%'
   OR guest_customer_info->>'email' = 'customer@test.com')
  -- OR test payment intent IDs
  OR payment_intent_id LIKE 'pi_test_%'
  OR payment_intent_id LIKE 'test_%';