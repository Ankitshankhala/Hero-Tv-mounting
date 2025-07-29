-- Drop all existing insert policies for bookings to avoid conflicts
DROP POLICY IF EXISTS "Allow authenticated and guest booking creation" ON public.bookings;
DROP POLICY IF EXISTS "Anyone can create bookings including guests" ON public.bookings;
DROP POLICY IF EXISTS "Temporary debug guest policy" ON public.bookings;

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

-- Create a temporary very permissive policy that logs everything
CREATE POLICY "Debug guest booking policy" ON public.bookings
FOR INSERT 
WITH CHECK (
  -- This will always allow but log the debug info
  debug_guest_booking_policy(customer_id, guest_customer_info) IS NOT NULL
);