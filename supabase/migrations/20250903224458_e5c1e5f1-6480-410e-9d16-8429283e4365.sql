-- Clean up orphaned data first
DELETE FROM public.booking_services 
WHERE booking_id NOT IN (SELECT id FROM public.bookings);

DELETE FROM public.invoice_items
WHERE invoice_id NOT IN (SELECT id FROM public.invoices);

DELETE FROM public.invoices
WHERE booking_id NOT IN (SELECT id FROM public.bookings);

-- Now apply the fixed constraints and system improvements
-- 1) Add foreign key constraints after cleanup
ALTER TABLE public.booking_services
  ADD CONSTRAINT fk_booking_services_booking
  FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_booking_services_booking_id ON public.booking_services(booking_id);

ALTER TABLE public.invoices
  ADD CONSTRAINT fk_invoices_booking
  FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_invoices_booking_id ON public.invoices(booking_id);

ALTER TABLE public.invoice_items
  ADD CONSTRAINT fk_invoice_items_invoice
  FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON public.invoice_items(invoice_id);

-- 2) Enforce invoice number uniqueness
ALTER TABLE public.invoices
  ADD CONSTRAINT uq_invoices_invoice_number UNIQUE (invoice_number);

-- 3) Create invoice sequence table for concurrency-safe numbering
CREATE TABLE IF NOT EXISTS public.invoice_sequences (
  year smallint PRIMARY KEY,
  last_value integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 4) Replace invoice number generator with concurrency-safe version
CREATE OR REPLACE FUNCTION public.generate_invoice_number()
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  year_full smallint := CAST(to_char(now(), 'YYYY') AS smallint);
  year_suffix text := to_char(now(), 'YY');
  seq_val integer;
  invoice_num text;
BEGIN
  -- Advisory lock scoped to current year to avoid race conditions
  PERFORM pg_advisory_xact_lock(hashtextextended('invoice_seq_' || year_full::text, 4242));

  INSERT INTO public.invoice_sequences(year, last_value)
  VALUES (year_full, 1)
  ON CONFLICT (year)
  DO UPDATE SET last_value = public.invoice_sequences.last_value + 1,
                updated_at = now()
  RETURNING last_value INTO seq_val;

  invoice_num := 'INV-' || year_suffix || '-' || LPAD(seq_val::text, 4, '0');
  RETURN invoice_num;
END;
$$;

-- 5) Ensure triggers are properly configured for invoice generation
DROP TRIGGER IF EXISTS trg_auto_invoice_bookings ON public.bookings;
CREATE TRIGGER trg_auto_invoice_bookings
  AFTER UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.trigger_auto_invoice();

DROP TRIGGER IF EXISTS trg_invoice_on_payment_capture ON public.transactions;
CREATE TRIGGER trg_invoice_on_payment_capture
  AFTER UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.trigger_invoice_on_payment_capture();

-- 6) Add helpful indexes for performance
CREATE INDEX IF NOT EXISTS idx_transactions_booking_id ON public.transactions(booking_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON public.bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_payment_status ON public.bookings(payment_status);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON public.transactions(status);