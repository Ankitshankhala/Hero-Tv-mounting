-- Create triggers to automatically send emails when booking status changes

-- Trigger for customer booking confirmation emails (when status becomes 'confirmed')
CREATE OR REPLACE TRIGGER trigger_customer_booking_confirmation
  AFTER UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.send_customer_booking_confirmation();

-- Trigger for worker assignment emails (when worker_id is assigned)  
CREATE OR REPLACE TRIGGER trigger_worker_assignment_notification
  AFTER UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.send_worker_assignment_notification();