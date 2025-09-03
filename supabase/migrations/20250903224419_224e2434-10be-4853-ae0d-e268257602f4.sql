-- 1) Ensure relationships exist so PostgREST can embed booking_services under bookings
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_schema = 'public'
      AND table_name = 'booking_services'
      AND constraint_name = 'fk_booking_services_booking'
  ) THEN
    ALTER TABLE public.booking_services
      ADD CONSTRAINT fk_booking_services_booking
      FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Helpful index for the FK
CREATE INDEX IF NOT EXISTS idx_booking_services_booking_id ON public.booking_services(booking_id);

-- 2) Ensure invoices link to bookings (for integrity and easier joins)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_schema = 'public'
      AND table_name = 'invoices'
      AND constraint_name = 'fk_invoices_booking'
  ) THEN
    ALTER TABLE public.invoices
      ADD CONSTRAINT fk_invoices_booking
      FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_invoices_booking_id ON public.invoices(booking_id);

-- 3) Ensure invoice_items link to invoices
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_schema = 'public'
      AND table_name = 'invoice_items'
      AND constraint_name = 'fk_invoice_items_invoice'
  ) THEN
    ALTER TABLE public.invoice_items
      ADD CONSTRAINT fk_invoice_items_invoice
      FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON public.invoice_items(invoice_id);

-- 4) Enforce uniqueness of invoice_number
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'public'
      AND table_name = 'invoices'
      AND constraint_name = 'uq_invoices_invoice_number'
  ) THEN
    ALTER TABLE public.invoices
      ADD CONSTRAINT uq_invoices_invoice_number UNIQUE (invoice_number);
  END IF;
END $$;

-- 5) Concurrency-safe invoice number sequencing per year
CREATE TABLE IF NOT EXISTS public.invoice_sequences (
  year smallint PRIMARY KEY,
  last_value integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Replace the generator to use advisory lock + upsert counter
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
  -- Advisory lock scoped to current year to avoid race conditions across functions
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

-- 6) Ensure triggers to fire invoice generation pipelines
-- a) On booking completion updates, call auto-invoice (which will check status and idempotency)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_auto_invoice_bookings') THEN
    -- Drop and recreate to ensure correct wiring
    DROP TRIGGER trg_auto_invoice_bookings ON public.bookings;
  END IF;
  CREATE TRIGGER trg_auto_invoice_bookings
  AFTER UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.trigger_auto_invoice();
END $$;

-- b) On payment capture completion, ensure the direct trigger to enhanced-invoice-generator exists
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_invoice_on_payment_capture') THEN
    CREATE TRIGGER trg_invoice_on_payment_capture
    AFTER UPDATE ON public.transactions
    FOR EACH ROW EXECUTE FUNCTION public.trigger_invoice_on_payment_capture();
  END IF;
END $$;

-- Optional: make sure transactions updates also notify auto-invoice only if we want that path
-- We avoid double-calling to reduce race conditions; rely on the dedicated payment-capture trigger above.

-- 7) Quick sanity indexes
CREATE INDEX IF NOT EXISTS idx_transactions_booking_id ON public.transactions(booking_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON public.bookings(status);
