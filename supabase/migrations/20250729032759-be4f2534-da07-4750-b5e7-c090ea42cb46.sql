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

-- Create a temporary debugging function to log RLS policy evaluation
CREATE OR REPLACE FUNCTION debug_guest_booking_policy(
  p_customer_id UUID,
  p_guest_customer_info JSONB
) RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Log the values being checked
  RAISE NOTICE 'Debug: customer_id = %, auth.uid() = %, guest_customer_info = %', 
    p_customer_id, auth.uid(), p_guest_customer_info;
  
  -- Check authenticated user condition
  IF p_customer_id = auth.uid() AND p_customer_id IS NOT NULL THEN
    RETURN 'authenticated_user_allowed';
  END IF;
  
  -- Check guest user condition
  IF p_customer_id IS NULL 
     AND p_guest_customer_info IS NOT NULL
     AND p_guest_customer_info->>'email' IS NOT NULL
     AND p_guest_customer_info->>'name' IS NOT NULL
     AND p_guest_customer_info->>'phone' IS NOT NULL THEN
    RETURN 'guest_user_allowed';
  END IF;
  
  RETURN 'access_denied';
END;
$$;

-- Create a temporary more permissive policy for testing
CREATE POLICY "Temporary debug guest policy" ON public.bookings
FOR INSERT 
WITH CHECK (
  -- Log the attempt
  debug_guest_booking_policy(customer_id, guest_customer_info) IS NOT NULL
);