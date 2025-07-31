-- Fix the update_booking_on_payment_auth function 
-- The function is correct - it operates on transactions table where 'authorized' is valid
-- But let's make sure all booking status updates use correct enum values

CREATE OR REPLACE FUNCTION public.update_booking_on_payment_auth()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- When a transaction becomes authorized, update booking to confirmed
  -- Payment authorization means the customer has authorized the charge and it's ready to be captured
  IF NEW.status = 'authorized' AND (OLD.status IS NULL OR OLD.status != 'authorized') THEN
    UPDATE bookings 
    SET 
      status = 'confirmed'::booking_status,
      payment_status = 'authorized'
    WHERE id = NEW.booking_id;
  END IF;
  
  -- When a transaction is completed (captured), keep booking as confirmed
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
$function$;