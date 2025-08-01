-- Verify and ensure all critical triggers are properly configured

-- Check and recreate triggers for the booking workflow

-- 1. Payment validation trigger (already exists)
-- 2. Auto-assignment trigger for confirmed bookings
DROP TRIGGER IF EXISTS trigger_auto_assign_on_authorized_booking ON public.bookings;
CREATE TRIGGER trigger_auto_assign_on_authorized_booking
  AFTER INSERT OR UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.trigger_auto_assign_on_authorized_booking();

-- 3. Customer confirmation email trigger
DROP TRIGGER IF EXISTS send_customer_booking_confirmation_trigger ON public.bookings;
CREATE TRIGGER send_customer_booking_confirmation_trigger
  AFTER UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.send_customer_booking_confirmation();

-- 4. Worker assignment email trigger  
DROP TRIGGER IF EXISTS send_worker_assignment_notification_trigger ON public.bookings;
CREATE TRIGGER send_worker_assignment_notification_trigger
  AFTER UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.send_worker_assignment_notification();

-- 5. Transaction status update trigger
DROP TRIGGER IF EXISTS update_booking_on_payment_auth_trigger ON public.transactions;
CREATE TRIGGER update_booking_on_payment_auth_trigger
  AFTER INSERT OR UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_booking_on_payment_auth();

-- 6. Worker assignment trigger
DROP TRIGGER IF EXISTS notify_worker_assignment_trigger ON public.bookings;  
CREATE TRIGGER notify_worker_assignment_trigger
  AFTER UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.notify_worker_assignment();

-- Verify all triggers are active
SELECT 
  trigger_name,
  event_object_table,
  action_timing,
  event_manipulation
FROM information_schema.triggers 
WHERE trigger_schema = 'public' 
AND event_object_table IN ('bookings', 'transactions')
ORDER BY event_object_table, trigger_name;