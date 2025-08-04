-- Remove test bookings safely
-- Target bookings with test customer information and test payment intent IDs

DELETE FROM bookings 
WHERE 
  -- Test bookings with guest customer info containing test data
  (guest_customer_info->>'email' LIKE '%test%' 
   OR guest_customer_info->>'name' LIKE '%Test%'
   OR guest_customer_info->>'email' = 'customer@test.com')
  -- OR test payment intent IDs
  OR payment_intent_id LIKE 'pi_test_%'
  OR payment_intent_id LIKE 'test_%';