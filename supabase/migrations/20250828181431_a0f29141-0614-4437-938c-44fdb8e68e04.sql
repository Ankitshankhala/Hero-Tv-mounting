-- Restore booking 1: Maximilian Stoehr - August 30, 2025
INSERT INTO bookings (
  id, service_id, customer_id, scheduled_date, scheduled_start, 
  local_service_date, local_service_time, status, payment_status,
  guest_customer_info, created_at, updated_at
) VALUES (
  '15cb76ff-00b8-48dd-8224-249ee435970c',
  'd767d150-8d93-4d24-a96d-db9a80a67bb2',
  NULL,
  '2025-08-30',
  '15:00:00',
  '2025-08-30',
  '15:00:00',
  'payment_pending',
  'pending',
  jsonb_build_object(
    'name', 'Maximilian Stoehr',
    'email', 'stoehrmax@gmail.com',
    'phone', '+1-555-0000',
    'zipcode', '10001',
    'city', 'New York',
    'address', '123 Main St'
  ),
  '2025-08-28 17:33:55+00',
  now()
);

-- Add booking service for booking 1
INSERT INTO booking_services (
  id, booking_id, service_id, service_name, quantity, base_price, configuration
) VALUES (
  gen_random_uuid(),
  '15cb76ff-00b8-48dd-8224-249ee435970c',
  'd767d150-8d93-4d24-a96d-db9a80a67bb2',
  'General Mounting',
  1,
  149.00,
  '{}'::jsonb
);

-- Restore booking 2: Aryan Kabira - August 28, 2025  
INSERT INTO bookings (
  id, service_id, customer_id, scheduled_date, scheduled_start,
  local_service_date, local_service_time, status, payment_status,
  guest_customer_info, created_at, updated_at
) VALUES (
  '8d618a1e-8702-4052-9859-5e98981e4cb5',
  'd767d150-8d93-4d24-a96d-db9a80a67bb2',
  NULL,
  '2025-08-28',
  '17:00:00',
  '2025-08-28', 
  '17:00:00',
  'payment_pending',
  'pending',
  jsonb_build_object(
    'name', 'Aryan Kabira',
    'email', 'gehlotchanchal2001@gmail.com',
    'phone', '+1-555-0001',
    'zipcode', '10002',
    'city', 'New York',
    'address', '456 Oak Ave'
  ),
  '2025-08-28 15:37:43+00',
  now()
);

-- Add booking service for booking 2
INSERT INTO booking_services (
  id, booking_id, service_id, service_name, quantity, base_price, configuration
) VALUES (
  gen_random_uuid(),
  '8d618a1e-8702-4052-9859-5e98981e4cb5',
  'd767d150-8d93-4d24-a96d-db9a80a67bb2',
  'General Mounting',
  1,
  149.00,
  '{}'::jsonb
);

-- Restore booking 3: Latrice Smith - September 2, 2025
INSERT INTO bookings (
  id, service_id, customer_id, scheduled_date, scheduled_start,
  local_service_date, local_service_time, status, payment_status,
  guest_customer_info, created_at, updated_at
) VALUES (
  '6d6d50bf-2555-4a76-88dc-e263b6addbe3',
  'd767d150-8d93-4d24-a96d-db9a80a67bb2',
  NULL,
  '2025-09-02',
  '10:00:00',
  '2025-09-02',
  '10:00:00',
  'payment_pending',
  'pending',
  jsonb_build_object(
    'name', 'Latrice Smith',
    'email', 'gemeni1980@yahoo.com',
    'phone', '+1-555-0002',
    'zipcode', '10003',
    'city', 'New York',
    'address', '789 Pine St'
  ),
  '2025-08-28 15:25:21+00',
  now()
);

-- Add booking service for booking 3
INSERT INTO booking_services (
  id, booking_id, service_id, service_name, quantity, base_price, configuration
) VALUES (
  gen_random_uuid(),
  '6d6d50bf-2555-4a76-88dc-e263b6addbe3',
  'd767d150-8d93-4d24-a96d-db9a80a67bb2',
  'General Mounting',
  1,
  149.00,
  '{}'::jsonb
);

-- Restore booking 4: Maximilian Stoehr - August 29, 2025
INSERT INTO bookings (
  id, service_id, customer_id, scheduled_date, scheduled_start,
  local_service_date, local_service_time, status, payment_status,
  guest_customer_info, created_at, updated_at
) VALUES (
  '3463527a-a317-4b7b-8000-a4a1fccdecef',
  'd767d150-8d93-4d24-a96d-db9a80a67bb2',
  NULL,
  '2025-08-29',
  '15:00:00',
  '2025-08-29',
  '15:00:00',
  'payment_pending',
  'pending',
  jsonb_build_object(
    'name', 'Maximilian Stoehr',
    'email', 'stoehrmax@gmail.com',
    'phone', '+1-555-0003',
    'zipcode', '10004',
    'city', 'New York',
    'address', '321 Elm Dr'
  ),
  '2025-08-28 15:16:01+00',
  now()
);

-- Add booking service for booking 4
INSERT INTO booking_services (
  id, booking_id, service_id, service_name, quantity, base_price, configuration
) VALUES (
  gen_random_uuid(),
  '3463527a-a317-4b7b-8000-a4a1fccdecef',
  'd767d150-8d93-4d24-a96d-db9a80a67bb2',
  'General Mounting',
  1,
  149.00,
  '{}'::jsonb
);

-- Log the recovery action
INSERT INTO sms_logs (booking_id, recipient_number, message, status, error_message)
VALUES 
  ('15cb76ff-00b8-48dd-8224-249ee435970c', 'system', 'Booking recovered from deletion - Maximilian Stoehr Aug 30', 'sent', NULL),
  ('8d618a1e-8702-4052-9859-5e98981e4cb5', 'system', 'Booking recovered from deletion - Aryan Kabira Aug 28', 'sent', NULL),
  ('6d6d50bf-2555-4a76-88dc-e263b6addbe3', 'system', 'Booking recovered from deletion - Latrice Smith Sep 2', 'sent', NULL),
  ('3463527a-a317-4b7b-8000-a4a1fccdecef', 'system', 'Booking recovered from deletion - Maximilian Stoehr Aug 29', 'sent', NULL);