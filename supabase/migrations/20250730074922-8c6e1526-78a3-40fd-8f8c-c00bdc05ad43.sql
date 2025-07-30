-- Create trigger to auto-assign workers when booking is created with authorized status
CREATE OR REPLACE FUNCTION public.trigger_auto_assign_on_authorized_booking()
RETURNS TRIGGER AS $$
BEGIN
  -- Only trigger for newly inserted bookings with 'authorized' status
  IF NEW.status = 'authorized' AND NEW.worker_id IS NULL THEN
    -- Call the auto-assignment function
    PERFORM public.auto_assign_workers_with_coverage(NEW.id);
  END IF;
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log error but don't fail the booking creation
  INSERT INTO public.sms_logs (booking_id, recipient_number, message, status, error_message)
  VALUES (NEW.id, 'system', 'Auto-assignment trigger failed', 'failed', SQLERRM);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger on bookings table
DROP TRIGGER IF EXISTS trigger_auto_assign_authorized_booking ON public.bookings;
CREATE TRIGGER trigger_auto_assign_authorized_booking
  AFTER INSERT ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_auto_assign_on_authorized_booking();