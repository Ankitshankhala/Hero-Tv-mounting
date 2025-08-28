-- Update the Vikram booking to assign Connor and confirm status
UPDATE bookings 
SET worker_id = '3e2e7780-6abd-40f5-a5a2-70286b7496de',
    status = 'confirmed'
WHERE id = 'a5db0396-35c2-472d-89fd-06166f55e316';

-- Add worker booking assignment for Vikram
INSERT INTO worker_bookings (
  id, booking_id, worker_id, status, ack_status, assigned_at
) VALUES (
  gen_random_uuid(),
  'a5db0396-35c2-472d-89fd-06166f55e316',
  '3e2e7780-6abd-40f5-a5a2-70286b7496de',
  'assigned',
  'acknowledged',
  now()
);

-- Log the Connor assignment
INSERT INTO sms_logs (booking_id, recipient_number, message, status, error_message)
VALUES ('a5db0396-35c2-472d-89fd-06166f55e316', 'system', 'Connor assigned to restored booking - Vikram Ahuja Aug 19', 'sent', NULL);