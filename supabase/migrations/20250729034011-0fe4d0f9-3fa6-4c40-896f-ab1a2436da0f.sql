-- Step 1: Create a logging table for RLS debugging
CREATE TABLE IF NOT EXISTS public.rls_debug_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  table_name TEXT NOT NULL,
  operation TEXT NOT NULL,
  user_id UUID,
  auth_uid UUID,
  policy_result TEXT,
  debug_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on debug logs (only admins can see)
ALTER TABLE public.rls_debug_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage debug logs" ON public.rls_debug_logs
FOR ALL USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

-- Step 2: Drop ALL existing insert policies on bookings table
DROP POLICY IF EXISTS "Debug guest booking policy" ON public.bookings;
DROP POLICY IF EXISTS "Allow authenticated and guest booking creation" ON public.bookings;
DROP POLICY IF EXISTS "Anyone can create bookings including guests" ON public.bookings;
DROP POLICY IF EXISTS "Temporary debug guest policy" ON public.bookings;

-- Step 3: Create a completely permissive temporary policy with logging
CREATE OR REPLACE FUNCTION public.log_booking_insert_attempt(
  p_customer_id UUID,
  p_guest_customer_info JSONB
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Log every insert attempt to the table
  INSERT INTO public.rls_debug_logs (
    table_name,
    operation,
    user_id,
    auth_uid,
    policy_result,
    debug_data
  ) VALUES (
    'bookings',
    'INSERT',
    p_customer_id,
    auth.uid(),
    'attempting_insert',
    jsonb_build_object(
      'customer_id', p_customer_id,
      'auth_uid', auth.uid(),
      'guest_customer_info', p_guest_customer_info,
      'has_auth_user', auth.uid() IS NOT NULL,
      'is_guest_booking', p_customer_id IS NULL,
      'has_guest_info', p_guest_customer_info IS NOT NULL
    )
  );
  
  -- Always return true for now (completely permissive)
  RETURN TRUE;
EXCEPTION WHEN OTHERS THEN
  -- Even if logging fails, allow the insert
  RETURN TRUE;
END;
$$;

-- Step 4: Create the extremely permissive policy
CREATE POLICY "Temporary completely permissive insert policy" ON public.bookings
FOR INSERT 
WITH CHECK (
  log_booking_insert_attempt(customer_id, guest_customer_info) = TRUE
);