-- Fix the payment authorization trigger to properly confirm bookings
-- when payment is authorized (not waiting for capture)

CREATE OR REPLACE FUNCTION public.update_booking_on_payment_auth()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  -- When a transaction becomes authorized, update booking to confirmed (not payment_authorized)
  -- Payment authorization means the customer has authorized the charge and it's ready to be captured
  IF NEW.status = 'authorized' AND (OLD.status IS NULL OR OLD.status != 'authorized') THEN
    UPDATE bookings 
    SET 
      status = 'confirmed'::booking_status,  -- Changed from payment_authorized to confirmed
      payment_status = 'authorized'
    WHERE id = NEW.booking_id;
  END IF;
  
  -- When a transaction is completed (captured), keep booking as confirmed
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    UPDATE bookings 
    SET 
      status = 'confirmed'::booking_status,  -- Keep as confirmed 
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

-- Also fix the auto-assignment trigger to work with confirmed status
CREATE OR REPLACE FUNCTION public.trigger_auto_assign_on_authorized_booking()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  -- Handle INSERT: trigger for newly inserted bookings with 'confirmed' status  
  IF TG_OP = 'INSERT' AND NEW.status = 'confirmed' AND NEW.worker_id IS NULL THEN
    -- Call the auto-assignment function
    PERFORM public.auto_assign_workers_with_coverage(NEW.id);
  -- Handle UPDATE: trigger when status changes to 'confirmed'
  ELSIF TG_OP = 'UPDATE' AND OLD.status != 'confirmed' AND NEW.status = 'confirmed' AND NEW.worker_id IS NULL THEN
    -- Call the auto-assignment function  
    PERFORM public.auto_assign_workers_with_coverage(NEW.id);
  END IF;
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log error but don't fail the booking creation/update
  INSERT INTO public.sms_logs (booking_id, recipient_number, message, status, error_message)
  VALUES (NEW.id, 'system', 'Auto-assignment trigger failed', 'failed', SQLERRM);
  RETURN NEW;
END;
$function$;