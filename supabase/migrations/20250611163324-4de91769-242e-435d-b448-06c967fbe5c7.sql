
-- Add columns to track customer approval workflow (these should work since they use IF NOT EXISTS)
ALTER TABLE invoice_modifications 
ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS customer_viewed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS customer_approved_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS customer_rejected_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- Add constraint for approval_status if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'invoice_modifications_approval_status_check'
    ) THEN
        ALTER TABLE invoice_modifications 
        ADD CONSTRAINT invoice_modifications_approval_status_check 
        CHECK (approval_status IN ('pending', 'approved', 'rejected'));
    END IF;
END $$;

-- Create or replace the notification function (this will update if it exists)
CREATE OR REPLACE FUNCTION create_modification_notification()
RETURNS TRIGGER AS $$
BEGIN
  -- Create notification for customer
  INSERT INTO notifications (
    user_id,
    title,
    message,
    type,
    related_booking_id,
    related_modification_id
  )
  SELECT 
    b.customer_id,
    'Invoice Modified',
    'Your booking invoice has been modified by the technician. Please review and approve the changes.',
    'warning',
    NEW.booking_id,
    NEW.id
  FROM bookings b
  WHERE b.id = NEW.booking_id;
  
  -- Update modification with notification timestamp
  UPDATE invoice_modifications 
  SET customer_notified_at = NOW()
  WHERE id = NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for new modifications (drop and recreate to ensure it's updated)
DROP TRIGGER IF EXISTS on_modification_created ON invoice_modifications;
CREATE TRIGGER on_modification_created
  AFTER INSERT ON invoice_modifications
  FOR EACH ROW
  EXECUTE FUNCTION create_modification_notification();
