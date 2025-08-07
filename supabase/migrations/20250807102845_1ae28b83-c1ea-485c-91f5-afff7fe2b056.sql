-- Enhanced invoice generation trigger system
-- Create a trigger that specifically fires on payment capture completion

-- Create function to trigger invoice on payment capture only
CREATE OR REPLACE FUNCTION public.trigger_invoice_on_payment_capture()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Only trigger when payment status changes to 'completed' (captured)
  IF NEW.status = 'completed' AND OLD.status != 'completed' AND NEW.transaction_type = 'capture' THEN
    
    -- Check if invoice already exists to prevent duplicates
    IF NOT EXISTS (
      SELECT 1 FROM invoices WHERE booking_id = NEW.booking_id
    ) THEN
      -- Call the enhanced generate-invoice function
      PERFORM pg_net.http_post(
        url := 'https://ggvplltpwsnvtcbpazbe.supabase.co/functions/v1/enhanced-invoice-generator',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdndnBsbHRwd3NudnRjYnBhemJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk1MTU5NjIsImV4cCI6MjA2NTA5MTk2Mn0.cbZ4kBKP7odpP9r1Qrg4G6CA8XdW7vLdKsqr6gE0j_Q'
        ),
        body := jsonb_build_object(
          'booking_id', NEW.booking_id,
          'transaction_id', NEW.id,
          'trigger_source', 'payment_capture',
          'send_email', true
        )
      );
      
      -- Log the invoice generation trigger
      INSERT INTO sms_logs (booking_id, recipient_number, message, status, error_message)
      VALUES (
        NEW.booking_id, 
        'system', 
        'Invoice generation triggered by payment capture', 
        'sent', 
        NULL
      );
    END IF;
  END IF;
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log error but don't fail the transaction
  INSERT INTO sms_logs (booking_id, recipient_number, message, status, error_message)
  VALUES (
    NEW.booking_id, 
    'system', 
    'Invoice generation trigger failed', 
    'failed', 
    SQLERRM
  );
  RETURN NEW;
END;
$function$;

-- Create the trigger
DROP TRIGGER IF EXISTS trigger_invoice_on_capture ON transactions;
CREATE TRIGGER trigger_invoice_on_capture
  AFTER UPDATE ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION trigger_invoice_on_payment_capture();

-- Add invoice delivery tracking fields
ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS pdf_generated BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS pdf_storage_path TEXT,
ADD COLUMN IF NOT EXISTS delivery_attempts INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_delivery_attempt TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS delivery_status TEXT DEFAULT 'pending';