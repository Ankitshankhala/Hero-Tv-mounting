
-- Fix RLS policies with proper cleanup - Part 1: Clean up existing policies
DROP POLICY IF EXISTS "Workers can create charges for their bookings" ON on_site_charges;
DROP POLICY IF EXISTS "Workers and customers can view relevant charges" ON on_site_charges;
DROP POLICY IF EXISTS "Admins can manage on-site charges" ON on_site_charges;
DROP POLICY IF EXISTS "Users can view their own payment sessions" ON payment_sessions;
DROP POLICY IF EXISTS "Service can manage payment sessions" ON payment_sessions;
DROP POLICY IF EXISTS "Workers can manage their own schedules" ON worker_schedules;
DROP POLICY IF EXISTS "Anyone can view worker schedules" ON worker_schedules;
DROP POLICY IF EXISTS "Workers can create modifications for their bookings" ON invoice_modifications;
DROP POLICY IF EXISTS "Users can view relevant invoice modifications" ON invoice_modifications;
DROP POLICY IF EXISTS "Workers can update their own modifications" ON invoice_modifications;
DROP POLICY IF EXISTS "Admins can manage all invoice modifications" ON invoice_modifications;

-- Enable RLS on tables that might not have it enabled
ALTER TABLE on_site_charges ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE worker_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_modifications ENABLE ROW LEVEL SECURITY;

-- Create policies for on_site_charges
CREATE POLICY "Workers can create charges for their bookings" ON on_site_charges
  FOR INSERT 
  WITH CHECK (
    worker_id = auth.uid() AND
    EXISTS (SELECT 1 FROM bookings WHERE id = booking_id AND worker_id = auth.uid())
  );

CREATE POLICY "Workers and customers can view relevant charges" ON on_site_charges
  FOR SELECT 
  USING (
    worker_id = auth.uid() OR
    EXISTS (SELECT 1 FROM bookings WHERE id = booking_id AND customer_id = auth.uid()) OR
    public.get_current_user_role() = 'admin'
  );

CREATE POLICY "Admins can manage on-site charges" ON on_site_charges
  FOR ALL
  USING (public.get_current_user_role() = 'admin');

-- Create policies for payment_sessions
CREATE POLICY "Users can view their own payment sessions" ON payment_sessions
  FOR SELECT 
  USING (
    booking_id IN (
      SELECT id FROM bookings WHERE customer_id = auth.uid()
    ) OR public.get_current_user_role() = 'admin'
  );

CREATE POLICY "Service can manage payment sessions" ON payment_sessions
  FOR ALL
  USING (true);

-- Create policies for worker_schedules
CREATE POLICY "Workers can manage their own schedules" ON worker_schedules
  FOR ALL 
  USING (
    worker_id = auth.uid() OR 
    public.get_current_user_role() = 'admin'
  );

CREATE POLICY "Anyone can view worker schedules" ON worker_schedules
  FOR SELECT 
  USING (true);

-- Create policies for invoice_modifications
CREATE POLICY "Workers can create modifications for their bookings" ON invoice_modifications
  FOR INSERT
  WITH CHECK (
    worker_id = auth.uid() AND
    EXISTS (SELECT 1 FROM bookings WHERE id = booking_id AND worker_id = auth.uid())
  );

CREATE POLICY "Users can view relevant invoice modifications" ON invoice_modifications
  FOR SELECT
  USING (
    worker_id = auth.uid() OR
    EXISTS (SELECT 1 FROM bookings WHERE id = booking_id AND customer_id = auth.uid()) OR
    public.get_current_user_role() = 'admin'
  );

CREATE POLICY "Workers can update their own modifications" ON invoice_modifications
  FOR UPDATE
  USING (worker_id = auth.uid() OR public.get_current_user_role() = 'admin');

CREATE POLICY "Admins can manage all invoice modifications" ON invoice_modifications
  FOR ALL
  USING (public.get_current_user_role() = 'admin');

-- Add missing columns for Google Calendar integration
ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS google_calendar_event_id TEXT,
ADD COLUMN IF NOT EXISTS is_calendar_synced BOOLEAN DEFAULT false;
