
-- Add a table to track invoice modifications
CREATE TABLE invoice_modifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
  worker_id UUID REFERENCES users(id) ON DELETE CASCADE,
  original_services JSONB NOT NULL,
  modified_services JSONB NOT NULL,
  original_total DECIMAL(10,2) NOT NULL,
  modified_total DECIMAL(10,2) NOT NULL,
  modification_reason TEXT,
  customer_approved BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add RLS policies for invoice modifications
ALTER TABLE invoice_modifications ENABLE ROW LEVEL SECURITY;

-- Workers can view modifications for their assigned bookings
CREATE POLICY "Workers can view their invoice modifications" 
  ON invoice_modifications 
  FOR SELECT 
  USING (
    worker_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM bookings 
      WHERE bookings.id = invoice_modifications.booking_id 
      AND bookings.worker_id = auth.uid()
    )
  );

-- Workers can create modifications for their assigned bookings
CREATE POLICY "Workers can create invoice modifications" 
  ON invoice_modifications 
  FOR INSERT 
  WITH CHECK (
    worker_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM bookings 
      WHERE bookings.id = invoice_modifications.booking_id 
      AND bookings.worker_id = auth.uid()
    )
  );

-- Admins can view all modifications
CREATE POLICY "Admins can view all invoice modifications" 
  ON invoice_modifications 
  FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Add invoice modification tracking to bookings table
ALTER TABLE bookings ADD COLUMN has_modifications BOOLEAN DEFAULT false;
ALTER TABLE bookings ADD COLUMN pending_payment_amount DECIMAL(10,2);
