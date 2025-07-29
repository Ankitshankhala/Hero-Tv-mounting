-- Fix RLS policy for guest bookings by handling NULL comparisons explicitly

-- Step 1: Drop the current problematic policy
DROP POLICY IF EXISTS "Allow authenticated and guest booking creation" ON public.bookings;

-- Step 2: Create the corrected RLS policy with explicit NULL handling
CREATE POLICY "Enable guest and authenticated booking creation" ON public.bookings
FOR INSERT 
WITH CHECK (
  -- For authenticated users: explicitly check they are logged in and creating for themselves
  (auth.uid() IS NOT NULL AND customer_id = auth.uid())
  OR
  -- For guest users: explicitly check they are NOT logged in and provide guest info
  (auth.uid() IS NULL AND customer_id IS NULL 
   AND guest_customer_info IS NOT NULL 
   AND guest_customer_info->>'email' IS NOT NULL 
   AND guest_customer_info->>'name' IS NOT NULL 
   AND guest_customer_info->>'phone' IS NOT NULL)
);