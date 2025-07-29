-- Complete RLS Policy Cleanup for Guest Bookings
-- Drop ALL existing policies on bookings table to eliminate conflicts

DROP POLICY IF EXISTS "Admins can manage all bookings" ON public.bookings;
DROP POLICY IF EXISTS "Customers can view their own bookings" ON public.bookings;
DROP POLICY IF EXISTS "Enable guest and authenticated booking creation" ON public.bookings;
DROP POLICY IF EXISTS "Enable guest booking updates via payment intent" ON public.bookings;
DROP POLICY IF EXISTS "Enable read access for booking participants" ON public.bookings;
DROP POLICY IF EXISTS "Enable update for booking participants" ON public.bookings;
DROP POLICY IF EXISTS "Guests can view bookings via payment intent" ON public.bookings;
DROP POLICY IF EXISTS "Workers can update their assigned bookings" ON public.bookings;
DROP POLICY IF EXISTS "Workers can view their assigned bookings" ON public.bookings;

-- Recreate minimal essential policies with clear boundaries

-- 1. INSERT policy for both authenticated and guest users
CREATE POLICY "Enable booking creation for all users" ON public.bookings
FOR INSERT 
WITH CHECK (
  -- Authenticated users creating their own bookings
  (auth.uid() IS NOT NULL AND customer_id = auth.uid())
  OR
  -- Guest users creating bookings (customer_id is NULL, guest_customer_info is provided)
  (auth.uid() IS NULL AND customer_id IS NULL AND guest_customer_info IS NOT NULL 
   AND (guest_customer_info->>'email') IS NOT NULL 
   AND (guest_customer_info->>'name') IS NOT NULL 
   AND (guest_customer_info->>'phone') IS NOT NULL)
);

-- 2. SELECT policy for viewing bookings
CREATE POLICY "Enable booking viewing for participants" ON public.bookings
FOR SELECT 
USING (
  -- Authenticated customers can view their bookings
  (customer_id = auth.uid())
  OR
  -- Workers can view their assigned bookings
  (worker_id = auth.uid())
  OR
  -- Guest users can view via payment_intent_id
  (customer_id IS NULL AND payment_intent_id IS NOT NULL)
  OR
  -- Admins can view all (but only if authenticated)
  (auth.uid() IS NOT NULL AND get_current_user_role() = 'admin')
);

-- 3. UPDATE policy for booking modifications
CREATE POLICY "Enable booking updates for participants" ON public.bookings
FOR UPDATE 
USING (
  -- Authenticated customers can update their bookings
  (auth.uid() IS NOT NULL AND customer_id = auth.uid())
  OR
  -- Workers can update their assigned bookings
  (auth.uid() IS NOT NULL AND worker_id = auth.uid())
  OR
  -- Guest bookings can be updated via payment_intent_id (for payment flow)
  (auth.uid() IS NULL AND customer_id IS NULL AND payment_intent_id IS NOT NULL)
  OR
  -- Admins can update all (but only if authenticated)
  (auth.uid() IS NOT NULL AND get_current_user_role() = 'admin')
);

-- 4. Admin management policy (separate from above to avoid conflicts)
CREATE POLICY "Admin full access to bookings" ON public.bookings
FOR ALL 
USING (auth.uid() IS NOT NULL AND get_current_user_role() = 'admin');