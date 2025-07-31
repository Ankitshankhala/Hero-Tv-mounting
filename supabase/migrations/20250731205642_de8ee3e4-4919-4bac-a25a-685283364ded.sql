-- Enable pg_net extension for HTTP requests from database triggers
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create trigger for worker assignment notifications
DROP TRIGGER IF EXISTS trigger_send_worker_assignment_notification ON public.bookings;
CREATE TRIGGER trigger_send_worker_assignment_notification
  AFTER UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.send_worker_assignment_notification();

-- Create trigger for customer booking confirmations  
DROP TRIGGER IF EXISTS trigger_send_customer_booking_confirmation ON public.bookings;
CREATE TRIGGER trigger_send_customer_booking_confirmation
  AFTER UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.send_customer_booking_confirmation();