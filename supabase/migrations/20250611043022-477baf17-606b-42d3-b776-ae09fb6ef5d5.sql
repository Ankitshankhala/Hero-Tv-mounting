
-- Check existing policies and create only missing ones

-- Drop existing policies that might conflict and recreate them
DROP POLICY IF EXISTS "Customers can view their own bookings" ON bookings;
DROP POLICY IF EXISTS "Workers can view their assigned bookings" ON bookings;
DROP POLICY IF EXISTS "Workers can update their assigned bookings" ON bookings;
DROP POLICY IF EXISTS "Admins can view all bookings" ON bookings;
DROP POLICY IF EXISTS "Admins can update any booking" ON bookings;

-- Allow anyone to create bookings (for customer booking flow)
CREATE POLICY "Anyone can create bookings" ON bookings
  FOR INSERT 
  WITH CHECK (true);

-- Allow customers to view their own bookings
CREATE POLICY "Customers can view their own bookings" ON bookings
  FOR SELECT 
  USING (customer_id = auth.uid());

-- Allow workers to view their assigned bookings
CREATE POLICY "Workers can view their assigned bookings" ON bookings
  FOR SELECT 
  USING (worker_id = auth.uid());

-- Allow workers to update their assigned bookings
CREATE POLICY "Workers can update their assigned bookings" ON bookings
  FOR UPDATE 
  USING (worker_id = auth.uid());

-- Allow admins to view and manage all bookings
CREATE POLICY "Admins can view all bookings" ON bookings
  FOR SELECT 
  USING (public.get_current_user_role() = 'admin');

CREATE POLICY "Admins can update any booking" ON bookings
  FOR UPDATE 
  USING (public.get_current_user_role() = 'admin');

CREATE POLICY "Admins can delete bookings" ON bookings
  FOR DELETE 
  USING (public.get_current_user_role() = 'admin');
