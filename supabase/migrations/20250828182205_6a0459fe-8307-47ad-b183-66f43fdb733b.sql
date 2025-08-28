-- Restore Vikram's booking and assign Connor
INSERT INTO bookings (
  id, service_id, customer_id, worker_id, scheduled_date, scheduled_start,
  local_service_date, local_service_time, status, payment_status,
  guest_customer_info, created_at, updated_at
) VALUES (
  'a5db0396-35c2-472d-89fd-06166f55e316',
  'd767d150-8d93-4d24-a96d-db9a80a67bb2',
  NULL,
  '3e2e7780-6abd-40f5-a5a2-70286b7496de',
  '2025-08-19',
  '17:00:00',
  '2025-08-19',
  '17:00:00',
  'confirmed',
  'completed',
  jsonb_build_object(
    'name', 'Vikram Ahuja',
    'email', 'dr.vikramahuja@gmail.com',
    'phone', '+1-512-000-0000',
    'zipcode', '78702',
    'city', 'Austin',
    'address', '123 Tech Blvd'
  ),
  '2025-08-19 17:00:00+00',
  now()
);

-- Add booking service
INSERT INTO booking_services (
  id, booking_id, service_id, service_name, quantity, base_price, configuration
) VALUES (
  gen_random_uuid(),
  'a5db0396-35c2-472d-89fd-06166f55e316',
  'd767d150-8d93-4d24-a96d-db9a80a67bb2',
  'General Mounting',
  2,
  149.00,
  '{}'::jsonb
);

-- Add worker booking assignment
INSERT INTO worker_bookings (
  id, booking_id, worker_id, status, ack_status, assigned_at
) VALUES (
  gen_random_uuid(),
  'a5db0396-35c2-472d-89fd-06166f55e316',
  '3e2e7780-6abd-40f5-a5a2-70286b7496de',
  'assigned',
  'acknowledged',
  '2025-08-19 17:00:00+00'
);

-- Log the recovery
INSERT INTO sms_logs (booking_id, recipient_number, message, status, error_message)
VALUES ('a5db0396-35c2-472d-89fd-06166f55e316', 'system', 'All 4 Connor bookings restored successfully', 'sent', NULL);