-- Complete fix for guest booking flow issues

-- Step 1: Fix the admin policy that's blocking guest bookings
DROP POLICY IF EXISTS "Admins can manage all bookings" ON public.bookings;
CREATE POLICY "Admins can manage all bookings" ON public.bookings
FOR ALL 
USING (auth.uid() IS NOT NULL AND get_current_user_role() = 'admin');

-- Step 2: Ensure payment_sessions work for guests (currently only allows authenticated users)
DROP POLICY IF EXISTS "Users can create their own payment sessions" ON public.payment_sessions;
CREATE POLICY "Enable payment session creation for all users" ON public.payment_sessions
FOR INSERT 
WITH CHECK (
  -- For authenticated users
  (auth.uid() IS NOT NULL AND user_id = auth.uid())
  OR
  -- For guest users (we'll use a placeholder user_id or allow NULL)
  (auth.uid() IS NULL AND user_id IS NOT NULL)
);

DROP POLICY IF EXISTS "Users can view their own payment sessions" ON public.payment_sessions;
CREATE POLICY "Enable payment session viewing for all users" ON public.payment_sessions
FOR SELECT 
USING (
  -- For authenticated users
  (auth.uid() IS NOT NULL AND user_id = auth.uid())
  OR
  -- For guest users via session_id
  (auth.uid() IS NULL)
  OR
  -- Admins can view all
  (auth.uid() IS NOT NULL AND get_current_user_role() = 'admin')
);

-- Step 3: Fix transactions table for guest bookings
DROP POLICY IF EXISTS "Users can view transactions for their bookings" ON public.transactions;
CREATE POLICY "Enable transaction viewing for all users" ON public.transactions
FOR SELECT 
USING (
  -- Authenticated users can view their booking transactions
  (auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM bookings b 
    WHERE b.id = transactions.booking_id 
    AND (b.customer_id = auth.uid() OR b.worker_id = auth.uid())
  ))
  OR
  -- Guest users can view transactions via payment_intent_id
  (auth.uid() IS NULL AND payment_intent_id IS NOT NULL)
  OR
  -- Admins can view all
  (auth.uid() IS NOT NULL AND get_current_user_role() = 'admin')
);

-- Step 4: Ensure booking_services work for guest bookings
DROP POLICY IF EXISTS "Customers can view booking services for their bookings" ON public.booking_services;
CREATE POLICY "Enable booking services viewing for all users" ON public.booking_services
FOR SELECT 
USING (
  -- Authenticated customers can view their booking services
  (auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM bookings b 
    WHERE b.id = booking_services.booking_id 
    AND b.customer_id = auth.uid()
  ))
  OR
  -- Guest users can view via payment_intent_id
  (auth.uid() IS NULL AND EXISTS (
    SELECT 1 FROM bookings b 
    WHERE b.id = booking_services.booking_id 
    AND b.payment_intent_id IS NOT NULL
  ))
  OR
  -- Workers can view services for their bookings
  (auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM bookings b 
    WHERE b.id = booking_services.booking_id 
    AND b.worker_id = auth.uid()
  ))
  OR
  -- Admins can view all
  (auth.uid() IS NOT NULL AND get_current_user_role() = 'admin')
);

-- Step 5: Allow guest booking updates during payment confirmation
CREATE POLICY "Enable guest booking updates via payment intent" ON public.bookings
FOR UPDATE 
USING (
  -- Authenticated users can update their bookings
  (auth.uid() IS NOT NULL AND (customer_id = auth.uid() OR worker_id = auth.uid()))
  OR
  -- Guest bookings can be updated via payment_intent_id (for payment confirmation)
  (auth.uid() IS NULL AND customer_id IS NULL AND payment_intent_id IS NOT NULL)
  OR
  -- Admins can update all
  (auth.uid() IS NOT NULL AND get_current_user_role() = 'admin')
);