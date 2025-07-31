-- Phase 2: Database Migration - Clean up enums and fix data consistency

-- Step 1: Fix inconsistent booking data first
-- Update confirmed bookings with pending payment to have consistent states
UPDATE bookings 
SET status = 'payment_pending'::booking_status 
WHERE status = 'confirmed'::booking_status 
  AND payment_status = 'pending'::text;

-- Step 2: Remove duplicate enum values from booking_status
-- First, ensure no bookings use the duplicate values we're removing
UPDATE bookings 
SET status = 'payment_authorized'::booking_status 
WHERE status = 'authorized'::booking_status;

UPDATE bookings 
SET status = 'completed'::booking_status 
WHERE status = 'captured'::booking_status;

-- Remove the duplicate enum values from booking_status
ALTER TYPE booking_status RENAME TO booking_status_old;

CREATE TYPE booking_status AS ENUM (
  'pending',
  'payment_pending', 
  'payment_authorized',
  'confirmed',
  'in_progress',
  'completed',
  'cancelled',
  'failed'
);

ALTER TABLE bookings 
ALTER COLUMN status TYPE booking_status 
USING status::text::booking_status;

DROP TYPE booking_status_old;

-- Step 3: Add validation function for booking/payment status consistency
CREATE OR REPLACE FUNCTION validate_booking_payment_consistency()
RETURNS TRIGGER AS $$
BEGIN
  -- Ensure booking_status and payment_status are consistent
  CASE NEW.status
    WHEN 'payment_pending' THEN
      IF NEW.payment_status NOT IN ('pending') THEN
        RAISE EXCEPTION 'payment_pending bookings must have pending payment_status, got: %', NEW.payment_status;
      END IF;
    WHEN 'payment_authorized' THEN
      IF NEW.payment_status NOT IN ('authorized') THEN
        RAISE EXCEPTION 'payment_authorized bookings must have authorized payment_status, got: %', NEW.payment_status;
      END IF;
    WHEN 'confirmed' THEN
      IF NEW.payment_status NOT IN ('authorized', 'completed') THEN
        RAISE EXCEPTION 'confirmed bookings must have authorized or completed payment_status, got: %', NEW.payment_status;
      END IF;
    WHEN 'completed' THEN
      IF NEW.payment_status NOT IN ('completed') THEN
        RAISE EXCEPTION 'completed bookings must have completed payment_status, got: %', NEW.payment_status;
      END IF;
    WHEN 'cancelled' THEN
      IF NEW.payment_status NOT IN ('failed', 'cancelled') THEN
        RAISE EXCEPTION 'cancelled bookings must have failed or cancelled payment_status, got: %', NEW.payment_status;
      END IF;
    WHEN 'failed' THEN
      IF NEW.payment_status NOT IN ('failed') THEN
        RAISE EXCEPTION 'failed bookings must have failed payment_status, got: %', NEW.payment_status;
      END IF;
  END CASE;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 4: Create trigger for booking/payment status consistency
CREATE TRIGGER validate_booking_payment_consistency_trigger
  BEFORE INSERT OR UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION validate_booking_payment_consistency();

-- Step 5: Update the existing payment authorization trigger to handle new states
DROP TRIGGER IF EXISTS update_booking_on_payment_auth_trigger ON transactions;

CREATE OR REPLACE FUNCTION update_booking_on_payment_auth()
RETURNS TRIGGER AS $$
BEGIN
  -- When a transaction becomes authorized, update booking to payment_authorized
  IF NEW.status = 'authorized' AND (OLD.status IS NULL OR OLD.status != 'authorized') THEN
    UPDATE bookings 
    SET 
      status = 'payment_authorized'::booking_status,
      payment_status = 'authorized'
    WHERE id = NEW.booking_id;
  END IF;
  
  -- When a transaction is completed (captured), update booking to confirmed
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    UPDATE bookings 
    SET 
      status = 'confirmed'::booking_status,
      payment_status = 'completed'
    WHERE id = NEW.booking_id;
  END IF;
  
  -- When a transaction fails, update booking appropriately
  IF NEW.status = 'failed' AND (OLD.status IS NULL OR OLD.status != 'failed') THEN
    UPDATE bookings 
    SET 
      status = 'failed'::booking_status,
      payment_status = 'failed'
    WHERE id = NEW.booking_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_booking_on_payment_auth_trigger
  AFTER INSERT OR UPDATE ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_booking_on_payment_auth();

-- Step 6: Validation queries to ensure consistency
-- These will be logged for verification
DO $$
DECLARE
  inconsistent_count INTEGER;
BEGIN
  -- Check for any remaining inconsistent booking/payment status combinations
  SELECT COUNT(*) INTO inconsistent_count
  FROM bookings
  WHERE 
    (status = 'payment_pending' AND payment_status != 'pending') OR
    (status = 'payment_authorized' AND payment_status != 'authorized') OR
    (status = 'confirmed' AND payment_status NOT IN ('authorized', 'completed')) OR
    (status = 'completed' AND payment_status != 'completed') OR
    (status = 'cancelled' AND payment_status NOT IN ('failed', 'cancelled')) OR
    (status = 'failed' AND payment_status != 'failed');
  
  IF inconsistent_count > 0 THEN
    RAISE EXCEPTION 'Found % bookings with inconsistent status combinations after migration', inconsistent_count;
  END IF;
  
  -- Log successful validation
  INSERT INTO sms_logs (booking_id, recipient_number, message, status, error_message)
  VALUES (NULL, 'system', 'Phase 2 migration completed successfully - all booking/payment statuses are consistent', 'sent', NULL);
END $$;