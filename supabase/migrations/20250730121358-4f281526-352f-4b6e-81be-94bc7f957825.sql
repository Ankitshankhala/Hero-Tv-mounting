-- Update the trigger to also fire on UPDATE operations when status changes to 'authorized'
DROP TRIGGER IF EXISTS trigger_auto_assign_authorized_booking ON public.bookings;

-- Create a new trigger that fires on both INSERT and UPDATE
CREATE TRIGGER trigger_auto_assign_authorized_booking
  AFTER INSERT OR UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_auto_assign_on_authorized_booking();

-- Update the trigger function to handle both INSERT and UPDATE cases
CREATE OR REPLACE FUNCTION public.trigger_auto_assign_on_authorized_booking()
RETURNS TRIGGER AS $$
BEGIN
  -- Handle INSERT: trigger for newly inserted bookings with 'authorized' status
  IF TG_OP = 'INSERT' AND NEW.status = 'authorized' AND NEW.worker_id IS NULL THEN
    -- Call the auto-assignment function
    PERFORM public.auto_assign_workers_with_coverage(NEW.id);
  -- Handle UPDATE: trigger when status changes to 'authorized'
  ELSIF TG_OP = 'UPDATE' AND OLD.status != 'authorized' AND NEW.status = 'authorized' AND NEW.worker_id IS NULL THEN
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
$$ LANGUAGE plpgsql SECURITY DEFINER;