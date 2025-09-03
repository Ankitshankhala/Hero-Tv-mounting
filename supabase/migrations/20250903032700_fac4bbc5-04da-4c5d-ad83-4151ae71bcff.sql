-- Add unique index on invoices.booking_id to prevent duplicate invoices
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_booking_id_unique 
ON public.invoices(booking_id);

-- Update enhanced-invoice-generator to determine invoice status based on payment capture
CREATE OR REPLACE FUNCTION public.determine_invoice_status(p_booking_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  total_captured NUMERIC := 0;
  total_amount NUMERIC := 0;
BEGIN
  -- Get total captured amount for this booking
  SELECT COALESCE(SUM(t.amount), 0) INTO total_captured
  FROM transactions t
  WHERE t.booking_id = p_booking_id 
    AND t.status = 'completed' 
    AND t.transaction_type IN ('capture', 'charge');
  
  -- Get expected amount from booking services or base service
  SELECT 
    CASE 
      WHEN EXISTS (SELECT 1 FROM booking_services bs WHERE bs.booking_id = p_booking_id) THEN
        COALESCE((SELECT SUM(bs.base_price * bs.quantity) FROM booking_services bs WHERE bs.booking_id = p_booking_id), 0)
      ELSE
        COALESCE((SELECT s.base_price FROM bookings b JOIN services s ON b.service_id = s.id WHERE b.id = p_booking_id), 0)
    END
  INTO total_amount;
  
  -- Return status based on payment capture
  IF total_captured >= total_amount AND total_captured > 0 THEN
    RETURN 'paid';
  ELSE
    RETURN 'unpaid';
  END IF;
END;
$$;