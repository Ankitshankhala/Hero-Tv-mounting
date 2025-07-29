-- Drop the current overly permissive insert policy
DROP POLICY IF EXISTS "Anyone can create bookings including guests" ON public.bookings;

-- Create a new, more secure policy for booking creation
CREATE POLICY "Allow authenticated and guest booking creation" ON public.bookings
FOR INSERT 
WITH CHECK (
  -- Authenticated users can create bookings with their own customer_id
  (customer_id = auth.uid() AND customer_id IS NOT NULL)
  OR
  -- Guest users can create bookings with NULL customer_id and valid guest info
  (
    customer_id IS NULL 
    AND guest_customer_info IS NOT NULL
    AND guest_customer_info->>'email' IS NOT NULL
    AND guest_customer_info->>'name' IS NOT NULL
    AND guest_customer_info->>'phone' IS NOT NULL
  )
);