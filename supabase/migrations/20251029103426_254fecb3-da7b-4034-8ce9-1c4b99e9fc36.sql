-- Backfill existing tips from transactions to bookings
UPDATE bookings b
SET tip_amount = t.tip_amount,
    updated_at = NOW()
FROM transactions t
WHERE b.id = t.booking_id
  AND t.tip_amount > 0
  AND (b.tip_amount IS NULL OR b.tip_amount = 0);

-- Create trigger function to auto-sync tips from transactions to bookings
CREATE OR REPLACE FUNCTION sync_booking_tip_from_transaction()
RETURNS TRIGGER AS $$
BEGIN
  -- Update booking tip_amount whenever a transaction with tip is created/updated
  UPDATE bookings
  SET tip_amount = NEW.tip_amount,
      updated_at = NOW()
  WHERE id = NEW.booking_id
    AND (tip_amount IS NULL OR tip_amount = 0 OR NEW.tip_amount > tip_amount);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on transactions table
DROP TRIGGER IF EXISTS sync_tip_to_booking ON transactions;
CREATE TRIGGER sync_tip_to_booking
AFTER INSERT OR UPDATE OF tip_amount ON transactions
FOR EACH ROW
WHEN (NEW.tip_amount > 0)
EXECUTE FUNCTION sync_booking_tip_from_transaction();

-- Create logging table for audit trail
CREATE TABLE IF NOT EXISTS tip_sync_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID NOT NULL REFERENCES bookings(id),
  transaction_id UUID NOT NULL REFERENCES transactions(id),
  tip_amount NUMERIC NOT NULL,
  synced_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on tip_sync_log
ALTER TABLE tip_sync_log ENABLE ROW LEVEL SECURITY;

-- Admins can view tip sync logs
CREATE POLICY "Admins can view tip sync logs"
ON tip_sync_log
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role = 'admin'
  )
);

-- System can insert tip sync logs
CREATE POLICY "System can insert tip sync logs"
ON tip_sync_log
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Update the trigger function to include logging
CREATE OR REPLACE FUNCTION sync_booking_tip_from_transaction()
RETURNS TRIGGER AS $$
DECLARE
  rows_updated INTEGER;
BEGIN
  -- Update booking tip_amount whenever a transaction with tip is created/updated
  UPDATE bookings
  SET tip_amount = NEW.tip_amount,
      updated_at = NOW()
  WHERE id = NEW.booking_id
    AND (tip_amount IS NULL OR tip_amount = 0 OR NEW.tip_amount > tip_amount);
  
  GET DIAGNOSTICS rows_updated = ROW_COUNT;
  
  -- Log the sync if a booking was updated
  IF rows_updated > 0 THEN
    INSERT INTO tip_sync_log (booking_id, transaction_id, tip_amount)
    VALUES (NEW.booking_id, NEW.id, NEW.tip_amount);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;