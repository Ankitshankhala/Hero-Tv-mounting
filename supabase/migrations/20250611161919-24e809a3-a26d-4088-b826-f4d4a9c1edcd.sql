
-- Add notification system for invoice modifications
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info', -- 'info', 'success', 'warning', 'error'
  is_read BOOLEAN DEFAULT false,
  related_booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
  related_modification_id UUID REFERENCES invoice_modifications(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users can view their own notifications
CREATE POLICY "Users can view their own notifications" 
  ON notifications 
  FOR SELECT 
  USING (auth.uid() = user_id);

-- Service can create notifications
CREATE POLICY "Service can create notifications" 
  ON notifications 
  FOR INSERT 
  WITH CHECK (true);

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can update their own notifications" 
  ON notifications 
  FOR UPDATE 
  USING (auth.uid() = user_id);

-- Add approval workflow fields to invoice_modifications
ALTER TABLE invoice_modifications 
ADD COLUMN IF NOT EXISTS customer_notified_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS customer_viewed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS customer_approved_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS customer_rejected_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'pending'; -- 'pending', 'approved', 'rejected'

-- Function to create notification when modification is made
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

-- Create trigger for modification notifications
DROP TRIGGER IF EXISTS modification_notification_trigger ON invoice_modifications;
CREATE TRIGGER modification_notification_trigger
  AFTER INSERT ON invoice_modifications
  FOR EACH ROW
  EXECUTE FUNCTION create_modification_notification();
