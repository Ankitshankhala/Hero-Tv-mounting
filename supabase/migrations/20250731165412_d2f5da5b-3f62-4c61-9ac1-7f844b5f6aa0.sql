-- Update payment_status enum to support authorization workflow
ALTER TYPE payment_status ADD VALUE 'authorized';
ALTER TYPE payment_status ADD VALUE 'captured';
ALTER TYPE payment_status ADD VALUE 'cancelled';

-- Update booking_status enum to support payment authorization
ALTER TYPE booking_status ADD VALUE 'payment_authorized';

-- Update transactions table to support authorization workflow
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS captured_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS captured_by UUID REFERENCES auth.users(id);

-- Create trigger to update booking status when payment is authorized
CREATE OR REPLACE FUNCTION update_booking_on_payment_auth()
RETURNS TRIGGER AS $$
BEGIN
  -- When a transaction becomes authorized, update booking status
  IF NEW.status = 'authorized' AND OLD.status != 'authorized' THEN
    UPDATE bookings 
    SET 
      status = 'payment_authorized',
      payment_status = 'authorized'
    WHERE id = NEW.booking_id;
  END IF;
  
  -- When a transaction is captured, update booking and payment status
  IF NEW.status = 'captured' AND OLD.status = 'authorized' THEN
    UPDATE bookings 
    SET 
      status = 'confirmed',
      payment_status = 'captured'
    WHERE id = NEW.booking_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_update_booking_on_payment_auth ON transactions;
CREATE TRIGGER trigger_update_booking_on_payment_auth
  AFTER UPDATE ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_booking_on_payment_auth();