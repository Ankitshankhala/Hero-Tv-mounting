-- Step 1: Drop the temporary debugging policy and function
DROP POLICY IF EXISTS "Temporary completely permissive insert policy" ON public.bookings;
DROP FUNCTION IF EXISTS public.log_booking_insert_attempt(UUID, JSONB);

-- Step 2: Create the simple, definitive RLS policy for guest and authenticated bookings
CREATE POLICY "Allow authenticated and guest booking creation" ON public.bookings
FOR INSERT 
WITH CHECK (
  -- Allow authenticated users to create bookings for themselves
  (customer_id = auth.uid() AND customer_id IS NOT NULL)
  OR
  -- Allow guest users to create bookings with guest info
  (customer_id IS NULL AND guest_customer_info IS NOT NULL 
   AND guest_customer_info->>'email' IS NOT NULL 
   AND guest_customer_info->>'name' IS NOT NULL 
   AND guest_customer_info->>'phone' IS NOT NULL)
);

-- Step 3: Clean up debugging table (optional - keep for now in case we need to check logs)
-- DROP TABLE IF EXISTS public.rls_debug_logs;