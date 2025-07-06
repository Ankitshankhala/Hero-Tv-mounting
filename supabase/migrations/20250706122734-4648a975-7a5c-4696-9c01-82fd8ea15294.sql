-- Create trigger function to automatically generate invoices
CREATE OR REPLACE FUNCTION public.trigger_auto_invoice()
RETURNS TRIGGER AS $$
BEGIN
  -- Call the auto-invoice edge function via pg_net
  PERFORM pg_net.http_post(
    url := 'https://ggvplltpwsnvtcbpazbe.supabase.co/functions/v1/auto-invoice',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := jsonb_build_object(
      'type', TG_OP,
      'table', TG_TABLE_NAME,
      'record', row_to_json(NEW),
      'old_record', CASE WHEN TG_OP = 'UPDATE' THEN row_to_json(OLD) ELSE NULL END
    )
  );
  
  RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN OTHERS THEN
  -- Log error but don't fail the main operation
  INSERT INTO sms_logs (booking_id, recipient_number, message, status, error_message)
  VALUES (
    CASE WHEN TG_TABLE_NAME = 'bookings' THEN NEW.id ELSE NEW.booking_id END,
    'system',
    'Auto-invoice trigger failed',
    'failed',
    SQLERRM
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for bookings table
DROP TRIGGER IF EXISTS trigger_auto_invoice_on_booking_completion ON public.bookings;
CREATE TRIGGER trigger_auto_invoice_on_booking_completion
  AFTER UPDATE ON public.bookings
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'completed')
  EXECUTE FUNCTION public.trigger_auto_invoice();

-- Create trigger for transactions table  
DROP TRIGGER IF EXISTS trigger_auto_invoice_on_transaction_completion ON public.transactions;
CREATE TRIGGER trigger_auto_invoice_on_transaction_completion
  AFTER UPDATE ON public.transactions
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'completed')
  EXECUTE FUNCTION public.trigger_auto_invoice();

-- Enable pg_net extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_net;