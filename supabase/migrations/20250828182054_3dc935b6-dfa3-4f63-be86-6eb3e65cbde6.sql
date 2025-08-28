-- Update the existing restored booking to assign Connor
UPDATE bookings 
SET worker_id = '3e2e7780-6abd-40f5-a5a2-70286b7496de',
    status = 'confirmed'
WHERE id = 'a5db0396-35c2-472d-89fd-06166f55e316';

-- Restore booking 1: Gael Munoz - August 25, 2025 at 11:00 AM
INSERT INTO bookings (
  id, service_id, customer_id, worker_id, scheduled_date, scheduled_start,
  local_service_date, local_service_time, status, payment_status,
  guest_customer_info, location_notes, created_at, updated_at
) VALUES (
  'a55f5bce-32d4-44ca-b668-08c44eba99e3',
  'd767d150-8d93-4d24-a96d-db9a80a67bb2',
  NULL,
  '3e2e7780-6abd-40f5-a5a2-70286b7496de',
  '2025-08-25',
  '11:00:00',
  '2025-08-25',
  '11:00:00',
  'confirmed',
  'completed',
  jsonb_build_object(
    'name', 'Gael Munoz',
    'email', 'yaesdotp@gmail.com',
    'phone', '9565299335',
    'zipcode', '78702',
    'city', 'Austin',
    'address', '3225 2823 E MLK Jr BLVD'
  ),
  '3225 2823 E MLK Jr BLVD, Austin
Contact: Gael Munoz
Phone: 9565299335
Email: yaesdotp@gmail.com
ZIP: 78702
Special Instructions: If you need help accessing the unit, call 956 529 9335',
  '2025-08-25 05:36:13+00',
  now()
);

-- Add booking service for Gael
INSERT INTO booking_services (
  id, booking_id, service_id, service_name, quantity, base_price, configuration
) VALUES (
  gen_random_uuid(),
  'a55f5bce-32d4-44ca-b668-08c44eba99e3',
  'd767d150-8d93-4d24-a96d-db9a80a67bb2',
  'TV Mounting',
  1,
  0.00,
  '{}'::jsonb
);

-- Add worker booking assignment for Gael
INSERT INTO worker_bookings (
  id, booking_id, worker_id, status, ack_status, assigned_at
) VALUES (
  gen_random_uuid(),
  'a55f5bce-32d4-44ca-b668-08c44eba99e3',
  '3e2e7780-6abd-40f5-a5a2-70286b7496de',
  'assigned',
  'acknowledged',
  '2025-08-25 05:36:13+00'
);

-- Restore booking 2: Daniel Lopez - August 25, 2025 at 9:00 AM
INSERT INTO bookings (
  id, service_id, customer_id, worker_id, scheduled_date, scheduled_start,
  local_service_date, local_service_time, status, payment_status,
  guest_customer_info, created_at, updated_at
) VALUES (
  'e471e4fd-9102-4d31-84b7-2611a311ae23',
  'd767d150-8d93-4d24-a96d-db9a80a67bb2',
  NULL,
  '3e2e7780-6abd-40f5-a5a2-70286b7496de',
  '2025-08-25',
  '09:00:00',
  '2025-08-25',
  '09:00:00',
  'confirmed',
  'completed',
  jsonb_build_object(
    'name', 'Daniel Lopez',
    'email', 'dlopezctx@gmail.com',
    'phone', '+1-555-0004',
    'zipcode', '78701',
    'city', 'Austin',
    'address', '789 Main St'
  ),
  '2025-08-25 01:38:49+00',
  now()
);

-- Add booking service for Daniel
INSERT INTO booking_services (
  id, booking_id, service_id, service_name, quantity, base_price, configuration
) VALUES (
  gen_random_uuid(),
  'e471e4fd-9102-4d31-84b7-2611a311ae23',
  'd767d150-8d93-4d24-a96d-db9a80a67bb2',
  'TV Mounting',
  1,
  149.00,
  '{}'::jsonb
);

-- Add worker booking assignment for Daniel
INSERT INTO worker_bookings (
  id, booking_id, worker_id, status, ack_status, assigned_at
) VALUES (
  gen_random_uuid(),
  'e471e4fd-9102-4d31-84b7-2611a311ae23',
  '3e2e7780-6abd-40f5-a5a2-70286b7496de',
  'assigned',
  'acknowledged',
  '2025-08-25 01:38:49+00'
);

-- Restore booking 3: Aaron Doucet - August 25, 2025 at 8:00 AM  
INSERT INTO bookings (
  id, service_id, customer_id, worker_id, scheduled_date, scheduled_start,
  local_service_date, local_service_time, status, payment_status,
  guest_customer_info, created_at, updated_at
) VALUES (
  'e3d39098-7283-4d93-be61-4f0de8b61f72',
  'd767d150-8d93-4d24-a96d-db9a80a67bb2',
  NULL,
  '3e2e7780-6abd-40f5-a5a2-70286b7496de',
  '2025-08-25',
  '08:00:00',
  '2025-08-25',
  '08:00:00',
  'confirmed',
  'completed',
  jsonb_build_object(
    'name', 'Aaron Doucet',
    'email', 'aarondoucet09@yahoo.com',
    'phone', '+1-555-0005',
    'zipcode', '78702',
    'city', 'Austin',
    'address', '456 Oak St'
  ),
  '2025-08-23 14:30:13+00',
  now()
);

-- Add booking service for Aaron
INSERT INTO booking_services (
  id, booking_id, service_id, service_name, quantity, base_price, configuration
) VALUES (
  gen_random_uuid(),
  'e3d39098-7283-4d93-be61-4f0de8b61f72',
  'd767d150-8d93-4d24-a96d-db9a80a67bb2',
  'TV Mounting',
  1,
  149.00,
  '{}'::jsonb
);

-- Add worker booking assignment for Aaron
INSERT INTO worker_bookings (
  id, booking_id, worker_id, status, ack_status, assigned_at
) VALUES (
  gen_random_uuid(),
  'e3d39098-7283-4d93-be61-4f0de8b61f72',
  '3e2e7780-6abd-40f5-a5a2-70286b7496de',
  'assigned',
  'acknowledged',
  '2025-08-23 14:30:13+00'
);

-- Log the recovery actions
INSERT INTO sms_logs (booking_id, recipient_number, message, status, error_message)
VALUES 
  ('a5db0396-35c2-472d-89fd-06166f55e316', 'system', 'Connor assigned to restored booking - Vikram Ahuja', 'sent', NULL),
  ('a55f5bce-32d4-44ca-b668-08c44eba99e3', 'system', 'Connor booking recovered - Gael Munoz Aug 25 11:00 AM', 'sent', NULL),
  ('e471e4fd-9102-4d31-84b7-2611a311ae23', 'system', 'Connor booking recovered - Daniel Lopez Aug 25 9:00 AM', 'sent', NULL),
  ('e3d39098-7283-4d93-be61-4f0de8b61f72', 'system', 'Connor booking recovered - Aaron Doucet Aug 25 8:00 AM', 'sent', NULL);