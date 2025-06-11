
-- Enable RLS on tables that don't have it yet (this is safe to run even if already enabled)
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worker_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_modifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.on_site_charges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worker_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worker_availability ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first, then recreate them
DROP POLICY IF EXISTS "Anyone can view active services" ON public.services;
DROP POLICY IF EXISTS "Admins can manage services" ON public.services;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
DROP POLICY IF EXISTS "Admins can view all users" ON public.users;
DROP POLICY IF EXISTS "Admins can manage all users" ON public.users;
DROP POLICY IF EXISTS "Customers can view their own bookings" ON public.bookings;
DROP POLICY IF EXISTS "Workers can view their assigned bookings" ON public.bookings;
DROP POLICY IF EXISTS "Customers can create bookings" ON public.bookings;
DROP POLICY IF EXISTS "Workers can update their assigned bookings" ON public.bookings;
DROP POLICY IF EXISTS "Admins can manage all bookings" ON public.bookings;
DROP POLICY IF EXISTS "Admins can view all applications" ON public.worker_applications;
DROP POLICY IF EXISTS "Admins can manage all applications" ON public.worker_applications;
DROP POLICY IF EXISTS "Anyone can submit worker applications" ON public.worker_applications;
DROP POLICY IF EXISTS "Anyone can view reviews" ON public.reviews;
DROP POLICY IF EXISTS "Customers can create reviews for their bookings" ON public.reviews;
DROP POLICY IF EXISTS "Admins can manage all reviews" ON public.reviews;
DROP POLICY IF EXISTS "Users can view their own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Admins can manage all transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can view related invoice modifications" ON public.invoice_modifications;
DROP POLICY IF EXISTS "Workers can create invoice modifications" ON public.invoice_modifications;
DROP POLICY IF EXISTS "Customers can update modification approval status" ON public.invoice_modifications;
DROP POLICY IF EXISTS "Admins can manage all invoice modifications" ON public.invoice_modifications;
DROP POLICY IF EXISTS "Users can view related on-site charges" ON public.on_site_charges;
DROP POLICY IF EXISTS "Workers can create on-site charges" ON public.on_site_charges;
DROP POLICY IF EXISTS "Admins can manage all on-site charges" ON public.on_site_charges;
DROP POLICY IF EXISTS "Workers can manage their own schedules" ON public.worker_schedules;
DROP POLICY IF EXISTS "Admins can view all worker schedules" ON public.worker_schedules;
DROP POLICY IF EXISTS "Workers can manage their own availability" ON public.worker_availability;
DROP POLICY IF EXISTS "Admins can view all worker availability" ON public.worker_availability;

-- Services: Allow everyone to read active services (public data)
CREATE POLICY "Anyone can view active services" ON public.services
  FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage services" ON public.services
  FOR ALL USING (get_current_user_role() = 'admin');

-- Users/Profiles: Users can view their own profile, admins can view all
CREATE POLICY "Users can view their own profile" ON public.users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON public.users
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Admins can view all users" ON public.users
  FOR SELECT USING (get_current_user_role() = 'admin');

CREATE POLICY "Admins can manage all users" ON public.users
  FOR ALL USING (get_current_user_role() = 'admin');

-- Bookings: Users can see their own bookings, workers see assigned bookings, admins see all
CREATE POLICY "Customers can view their own bookings" ON public.bookings
  FOR SELECT USING (customer_id = auth.uid());

CREATE POLICY "Workers can view their assigned bookings" ON public.bookings
  FOR SELECT USING (worker_id = auth.uid());

CREATE POLICY "Customers can create bookings" ON public.bookings
  FOR INSERT WITH CHECK (customer_id = auth.uid());

CREATE POLICY "Workers can update their assigned bookings" ON public.bookings
  FOR UPDATE USING (worker_id = auth.uid());

CREATE POLICY "Admins can manage all bookings" ON public.bookings
  FOR ALL USING (get_current_user_role() = 'admin');

-- Worker Applications: Admins can view and manage all applications
CREATE POLICY "Admins can view all applications" ON public.worker_applications
  FOR SELECT USING (get_current_user_role() = 'admin');

CREATE POLICY "Admins can manage all applications" ON public.worker_applications
  FOR ALL USING (get_current_user_role() = 'admin');

CREATE POLICY "Anyone can submit worker applications" ON public.worker_applications
  FOR INSERT WITH CHECK (true);

-- Reviews: Customers can create reviews for their bookings, everyone can read reviews
CREATE POLICY "Anyone can view reviews" ON public.reviews
  FOR SELECT USING (true);

CREATE POLICY "Customers can create reviews for their bookings" ON public.reviews
  FOR INSERT WITH CHECK (
    customer_id = auth.uid() AND 
    EXISTS (SELECT 1 FROM bookings WHERE id = booking_id AND customer_id = auth.uid())
  );

CREATE POLICY "Admins can manage all reviews" ON public.reviews
  FOR ALL USING (get_current_user_role() = 'admin');

-- Transactions: Users can view their own transactions, admins can view all
CREATE POLICY "Users can view their own transactions" ON public.transactions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM bookings WHERE id = booking_id AND (customer_id = auth.uid() OR worker_id = auth.uid()))
  );

CREATE POLICY "Admins can manage all transactions" ON public.transactions
  FOR ALL USING (get_current_user_role() = 'admin');

-- Invoice Modifications: Customers and workers can view their related modifications, admins can view all
CREATE POLICY "Users can view related invoice modifications" ON public.invoice_modifications
  FOR SELECT USING (
    worker_id = auth.uid() OR 
    EXISTS (SELECT 1 FROM bookings WHERE id = booking_id AND customer_id = auth.uid())
  );

CREATE POLICY "Workers can create invoice modifications" ON public.invoice_modifications
  FOR INSERT WITH CHECK (worker_id = auth.uid());

CREATE POLICY "Customers can update modification approval status" ON public.invoice_modifications
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM bookings WHERE id = booking_id AND customer_id = auth.uid())
  );

CREATE POLICY "Admins can manage all invoice modifications" ON public.invoice_modifications
  FOR ALL USING (get_current_user_role() = 'admin');

-- On-site Charges: Similar to invoice modifications
CREATE POLICY "Users can view related on-site charges" ON public.on_site_charges
  FOR SELECT USING (
    worker_id = auth.uid() OR 
    EXISTS (SELECT 1 FROM bookings WHERE id = booking_id AND customer_id = auth.uid())
  );

CREATE POLICY "Workers can create on-site charges" ON public.on_site_charges
  FOR INSERT WITH CHECK (worker_id = auth.uid());

CREATE POLICY "Admins can manage all on-site charges" ON public.on_site_charges
  FOR ALL USING (get_current_user_role() = 'admin');

-- Worker Schedules: Workers can manage their own schedules, admins can view all
CREATE POLICY "Workers can manage their own schedules" ON public.worker_schedules
  FOR ALL USING (worker_id = auth.uid());

CREATE POLICY "Admins can view all worker schedules" ON public.worker_schedules
  FOR SELECT USING (get_current_user_role() = 'admin');

-- Worker Availability: Workers can manage their own availability, admins can view all
CREATE POLICY "Workers can manage their own availability" ON public.worker_availability
  FOR ALL USING (worker_id = auth.uid());

CREATE POLICY "Admins can view all worker availability" ON public.worker_availability
  FOR SELECT USING (get_current_user_role() = 'admin');
