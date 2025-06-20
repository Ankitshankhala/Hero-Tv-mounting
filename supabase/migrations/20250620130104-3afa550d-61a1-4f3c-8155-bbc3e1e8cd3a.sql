
-- Add missing columns to bookings table
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS pending_payment_amount DECIMAL(10,2);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS has_modifications BOOLEAN DEFAULT false;

-- Update existing bookings to have default values
UPDATE bookings 
SET pending_payment_amount = 0 
WHERE pending_payment_amount IS NULL;

UPDATE bookings 
SET has_modifications = false 
WHERE has_modifications IS NULL;
