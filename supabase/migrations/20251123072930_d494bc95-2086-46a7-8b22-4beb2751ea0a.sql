-- Fix the handle_duplicate_booking_service trigger that was causing booking_services insertions to fail
-- Root cause: RETURNING * INTO NEW when UPDATE finds no rows corrupts the NEW record with NULLs
-- This prevents booking_services from being inserted, breaking payment authorization

CREATE OR REPLACE FUNCTION handle_duplicate_booking_service()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if this exact service already exists for this booking
  -- If it does, increment the quantity instead of inserting a duplicate
  UPDATE booking_services
  SET 
    quantity = quantity + NEW.quantity,
    updated_at = now()
  WHERE 
    booking_id = NEW.booking_id 
    AND service_id = NEW.service_id;
  
  -- If UPDATE found a row (FOUND = true), prevent the INSERT
  -- If UPDATE found no rows (FOUND = false), allow the INSERT to proceed
  IF FOUND THEN
    -- Return NULL to prevent the INSERT
    RETURN NULL;
  ELSE
    -- Return NEW to allow the INSERT
    -- CRITICAL FIX: Do NOT use "RETURNING * INTO NEW" here
    -- That corrupts NEW with NULL values when no rows are found
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;