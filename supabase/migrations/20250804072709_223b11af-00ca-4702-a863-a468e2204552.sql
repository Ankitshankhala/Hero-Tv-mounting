-- Create a test booking for worker ankitshankhala2112@gmail.com
INSERT INTO bookings (
  scheduled_date,
  scheduled_start,
  service_id,
  worker_id,
  status,
  payment_status,
  guest_customer_info,
  location_notes,
  payment_intent_id
) VALUES (
  CURRENT_DATE + INTERVAL '2 days',  -- Schedule for 2 days from now
  '14:00:00',  -- 2:00 PM
  'd69350be-c842-4c8a-803e-e94c954a147e',  -- Furniture Assembly service
  '1d6b0847-7e4c-454a-be20-9a843e9b6df3',  -- Worker ID for ankitshankhala2112@gmail.com
  'confirmed',
  'authorized',
  jsonb_build_object(
    'name', 'John Test Customer',
    'email', 'test.customer@example.com',
    'phone', '555-123-4567',
    'zipcode', '10001',
    'city', 'New York City',
    'address', '123 Test Street, New York, NY 10001'
  ),
  'Apartment 4B, Building has elevator, Ring buzzer #4B',
  'pi_test_' || substr(gen_random_uuid()::text, 1, 20)  -- Generate test payment intent ID
);

-- Create corresponding booking service entry
INSERT INTO booking_services (
  booking_id,
  service_id,
  service_name,
  base_price,
  quantity,
  configuration
) VALUES (
  (SELECT id FROM bookings WHERE worker_id = '1d6b0847-7e4c-454a-be20-9a843e9b6df3' ORDER BY created_at DESC LIMIT 1),
  'd69350be-c842-4c8a-803e-e94c954a147e',
  'Furniture Assembly',
  50.00,
  1,
  jsonb_build_object(
    'furniture_type', 'Desk',
    'complexity', 'Medium',
    'estimated_time', '2 hours'
  )
);