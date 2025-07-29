-- Step 1: Update RLS policies to focus on guest bookings
-- Remove customer_id dependencies from booking policies

-- Drop existing policies that reference customer_id
DROP POLICY IF EXISTS "Enable booking viewing for participants" ON public.bookings;
DROP POLICY IF EXISTS "Enable booking updates for participants" ON public.bookings;
DROP POLICY IF EXISTS "Enable booking creation for all users" ON public.bookings;

-- Create new guest-focused policies
CREATE POLICY "Enable guest booking creation" ON public.bookings
FOR INSERT 
WITH CHECK (
  -- Allow creation with no customer_id (guest bookings)
  customer_id IS NULL 
  AND guest_customer_info IS NOT NULL 
  AND (guest_customer_info ->> 'email') IS NOT NULL 
  AND (guest_customer_info ->> 'name') IS NOT NULL 
  AND (guest_customer_info ->> 'phone') IS NOT NULL
);

CREATE POLICY "Enable guest booking viewing" ON public.bookings
FOR SELECT 
USING (
  -- Allow viewing if:
  -- 1. Guest booking with payment_intent_id (after payment)
  (customer_id IS NULL AND payment_intent_id IS NOT NULL)
  -- 2. Worker assigned to booking
  OR (worker_id = auth.uid())
  -- 3. Admin user
  OR ((auth.uid() IS NOT NULL) AND (get_current_user_role() = 'admin'))
);

CREATE POLICY "Enable guest booking updates" ON public.bookings
FOR UPDATE 
USING (
  -- Allow updates by:
  -- 1. Guest booking with payment_intent_id (for payment updates)
  (customer_id IS NULL AND payment_intent_id IS NOT NULL)
  -- 2. Worker assigned to booking
  OR (worker_id = auth.uid())
  -- 3. Admin user
  OR ((auth.uid() IS NOT NULL) AND (get_current_user_role() = 'admin'))
);

-- Update booking_services policies for guest bookings
DROP POLICY IF EXISTS "Enable booking services viewing for all users" ON public.booking_services;

CREATE POLICY "Enable guest booking services viewing" ON public.booking_services
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.bookings b 
    WHERE b.id = booking_services.booking_id 
    AND (
      -- Guest booking with payment
      (b.customer_id IS NULL AND b.payment_intent_id IS NOT NULL)
      -- Worker assigned to booking
      OR (b.worker_id = auth.uid())
      -- Admin user
      OR ((auth.uid() IS NOT NULL) AND (get_current_user_role() = 'admin'))
    )
  )
);

-- Comment: This migration simplifies the booking system to guest-only architecture
-- by removing customer_id dependencies and focusing on guest_customer_info