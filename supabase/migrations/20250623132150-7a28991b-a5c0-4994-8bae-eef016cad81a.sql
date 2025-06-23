
-- Create invoices table to track generated and sent invoices
CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  invoice_number TEXT NOT NULL UNIQUE,
  customer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  tax_amount DECIMAL(10,2) DEFAULT 0,
  total_amount DECIMAL(10,2) NOT NULL,
  invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'draft',
  email_sent BOOLEAN DEFAULT false,
  email_sent_at TIMESTAMPTZ NULL,
  pdf_url TEXT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create invoice_items table for detailed line items
CREATE TABLE public.invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  service_name TEXT NOT NULL,
  description TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL,
  total_price DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create function to generate unique invoice numbers
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TEXT AS $$
DECLARE
  year_suffix TEXT;
  sequence_num INTEGER;
  invoice_num TEXT;
BEGIN
  -- Get current year suffix (last 2 digits)
  year_suffix := TO_CHAR(CURRENT_DATE, 'YY');
  
  -- Get next sequence number for this year
  SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_number FROM 'INV-' || year_suffix || '-(.+)') AS INTEGER)), 0) + 1
  INTO sequence_num
  FROM invoices
  WHERE invoice_number LIKE 'INV-' || year_suffix || '-%';
  
  -- Format as INV-YY-NNNN
  invoice_num := 'INV-' || year_suffix || '-' || LPAD(sequence_num::TEXT, 4, '0');
  
  RETURN invoice_num;
END;
$$ LANGUAGE plpgsql;

-- Enable RLS on invoices table
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;

-- RLS policies for invoices
CREATE POLICY "Customers can view their own invoices" 
  ON public.invoices 
  FOR SELECT 
  USING (customer_id = auth.uid());

CREATE POLICY "Workers can view invoices for their bookings" 
  ON public.invoices 
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM bookings 
      WHERE bookings.id = invoices.booking_id 
      AND bookings.worker_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage all invoices" 
  ON public.invoices 
  FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'admin'
    )
  );

-- RLS policies for invoice_items
CREATE POLICY "Users can view invoice items for their accessible invoices" 
  ON public.invoice_items 
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM invoices 
      WHERE invoices.id = invoice_items.invoice_id 
      AND (
        invoices.customer_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM bookings 
          WHERE bookings.id = invoices.booking_id 
          AND bookings.worker_id = auth.uid()
        ) OR
        EXISTS (
          SELECT 1 FROM users 
          WHERE users.id = auth.uid() 
          AND users.role = 'admin'
        )
      )
    )
  );

CREATE POLICY "Admins can manage all invoice items" 
  ON public.invoice_items 
  FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'admin'
    )
  );

-- Create indexes for better performance
CREATE INDEX idx_invoices_booking_id ON invoices(booking_id);
CREATE INDEX idx_invoices_customer_id ON invoices(customer_id);
CREATE INDEX idx_invoices_invoice_number ON invoices(invoice_number);
CREATE INDEX idx_invoice_items_invoice_id ON invoice_items(invoice_id);

-- Create trigger to auto-update updated_at
CREATE TRIGGER update_invoices_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
