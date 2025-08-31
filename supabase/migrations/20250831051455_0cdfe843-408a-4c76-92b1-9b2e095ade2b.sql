-- Create missing transaction records for the specific bookings
INSERT INTO transactions (booking_id, amount, status, transaction_type, payment_method, currency)
VALUES 
  ('a3f479c5-97b5-4efd-92f3-05ce9e5512b3', 165, 'completed', 'capture', 'card', 'USD'),
  ('a5db0396-35c2-472d-89fd-06166f55e316', 165, 'completed', 'capture', 'card', 'USD');

-- Update these specific bookings to completed and archived
UPDATE bookings 
SET status = 'completed', 
    payment_status = 'completed',
    is_archived = true, 
    archived_at = now()
WHERE id IN ('a3f479c5-97b5-4efd-92f3-05ce9e5512b3', 'a5db0396-35c2-472d-89fd-06166f55e316');