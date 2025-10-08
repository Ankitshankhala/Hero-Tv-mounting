-- Phase 2: Add accounting integrity columns to invoices table
ALTER TABLE public.invoices 
  ADD COLUMN IF NOT EXISTS void_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS voided_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS void_reason TEXT,
  ADD COLUMN IF NOT EXISTS pdf_generated_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS last_email_attempt TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS email_attempts INTEGER DEFAULT 0;

-- Update invoice status to use proper accounting statuses
COMMENT ON COLUMN public.invoices.status IS 'Invoice status: draft, issued, paid, overdue, void, refunded';

-- Create invoice audit log table for tracking all changes
CREATE TABLE IF NOT EXISTS public.invoice_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  operation TEXT NOT NULL, -- 'created', 'updated', 'voided', 'paid', 'emailed', 'regenerated'
  old_data JSONB,
  new_data JSONB,
  changed_by UUID REFERENCES auth.users(id),
  change_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on invoice_audit_log
ALTER TABLE public.invoice_audit_log ENABLE ROW LEVEL SECURITY;

-- Admins can view all audit logs
CREATE POLICY "Admins can view invoice audit logs"
  ON public.invoice_audit_log FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- System can insert audit logs
CREATE POLICY "System can insert invoice audit logs"
  ON public.invoice_audit_log FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create function to log invoice changes
CREATE OR REPLACE FUNCTION public.log_invoice_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.invoice_audit_log (invoice_id, operation, new_data, changed_by)
    VALUES (NEW.id, 'created', to_jsonb(NEW), auth.uid());
  ELSIF TG_OP = 'UPDATE' THEN
    -- Only log significant changes
    IF OLD.status != NEW.status OR OLD.total_amount != NEW.total_amount OR OLD.email_sent != NEW.email_sent THEN
      INSERT INTO public.invoice_audit_log (invoice_id, operation, old_data, new_data, changed_by)
      VALUES (NEW.id, 'updated', to_jsonb(OLD), to_jsonb(NEW), auth.uid());
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger for invoice audit logging
DROP TRIGGER IF EXISTS invoice_audit_trigger ON public.invoices;
CREATE TRIGGER invoice_audit_trigger
  AFTER INSERT OR UPDATE ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.log_invoice_change();

-- Fix existing invoices with missing state codes (use TX as default)
UPDATE public.invoices 
SET state_code = 'TX' 
WHERE state_code IS NULL;

-- Add index for faster invoice queries
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_booking_id ON public.invoices(booking_id);
CREATE INDEX IF NOT EXISTS idx_invoices_customer_id ON public.invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoice_audit_log_invoice_id ON public.invoice_audit_log(invoice_id);

-- Create view for invoice reconciliation
CREATE OR REPLACE VIEW public.v_invoice_payment_reconciliation AS
SELECT 
  i.id AS invoice_id,
  i.invoice_number,
  i.booking_id,
  i.status AS invoice_status,
  i.total_amount AS invoice_amount,
  i.email_sent,
  i.delivery_status,
  b.status AS booking_status,
  b.payment_status AS booking_payment_status,
  COALESCE(SUM(CASE WHEN t.status = 'completed' AND t.transaction_type IN ('capture', 'charge') THEN t.amount ELSE 0 END), 0) AS total_captured,
  COALESCE(SUM(CASE WHEN t.status = 'completed' AND t.transaction_type = 'refund' THEN t.amount ELSE 0 END), 0) AS total_refunded,
  CASE 
    WHEN COALESCE(SUM(CASE WHEN t.status = 'completed' AND t.transaction_type IN ('capture', 'charge') THEN t.amount ELSE 0 END), 0) >= i.total_amount THEN 'paid'
    WHEN COALESCE(SUM(CASE WHEN t.status = 'completed' AND t.transaction_type = 'refund' THEN t.amount ELSE 0 END), 0) >= i.total_amount THEN 'refunded'
    WHEN i.due_date < CURRENT_DATE AND i.status NOT IN ('paid', 'void', 'refunded') THEN 'overdue'
    ELSE i.status
  END AS recommended_status
FROM public.invoices i
LEFT JOIN public.bookings b ON i.booking_id = b.id
LEFT JOIN public.transactions t ON i.booking_id = t.booking_id
GROUP BY i.id, i.invoice_number, i.booking_id, i.status, i.total_amount, i.email_sent, i.delivery_status, b.status, b.payment_status, i.due_date;