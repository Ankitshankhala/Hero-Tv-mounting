-- Fix race condition: Add unique constraint to prevent duplicate services in booking_services
-- This enforces idempotency at the database level

-- First, remove any existing duplicates (keep the most recent one)
WITH duplicates AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (
      PARTITION BY booking_id, service_id, base_price, configuration::text 
      ORDER BY created_at DESC
    ) as rn
  FROM booking_services
)
DELETE FROM booking_services
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);

-- Add unique constraint on booking_id + service_id + configuration
-- This prevents adding the exact same service with same config twice
CREATE UNIQUE INDEX IF NOT EXISTS booking_services_unique_service 
ON booking_services (booking_id, service_id, (configuration::text));

-- Create a function to handle service updates instead of duplicates
CREATE OR REPLACE FUNCTION handle_duplicate_booking_service()
RETURNS TRIGGER AS $$
BEGIN
  -- If a service with the same booking_id, service_id, and configuration exists,
  -- update its quantity instead of inserting a duplicate
  UPDATE booking_services 
  SET 
    quantity = quantity + NEW.quantity,
    updated_at = NOW()
  WHERE 
    booking_id = NEW.booking_id 
    AND service_id = NEW.service_id 
    AND configuration::text = NEW.configuration::text
  RETURNING * INTO NEW;
  
  -- If the UPDATE affected a row, don't insert
  IF FOUND THEN
    -- Return NULL to cancel the INSERT
    RETURN NULL;
  END IF;
  
  -- Otherwise, allow the INSERT
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to enforce idempotency
DROP TRIGGER IF EXISTS enforce_booking_service_idempotency ON booking_services;
CREATE TRIGGER enforce_booking_service_idempotency
  BEFORE INSERT ON booking_services
  FOR EACH ROW
  EXECUTE FUNCTION handle_duplicate_booking_service();

-- Add comment for documentation
COMMENT ON INDEX booking_services_unique_service IS 
  'Prevents duplicate services in a booking with same configuration. Trigger updates quantity instead.';