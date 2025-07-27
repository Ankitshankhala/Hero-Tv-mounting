-- Add triggers for automatic invoice generation

-- Create triggers on bookings table for status changes to 'completed'
CREATE TRIGGER bookings_auto_invoice_trigger
  AFTER UPDATE ON public.bookings
  FOR EACH ROW
  WHEN (NEW.status = 'completed' AND OLD.status != 'completed')
  EXECUTE FUNCTION public.trigger_auto_invoice();

-- Create triggers on transactions table for status changes to 'completed'  
CREATE TRIGGER transactions_auto_invoice_trigger
  AFTER UPDATE ON public.transactions
  FOR EACH ROW
  WHEN (NEW.status = 'completed' AND OLD.status != 'completed')
  EXECUTE FUNCTION public.trigger_auto_invoice();