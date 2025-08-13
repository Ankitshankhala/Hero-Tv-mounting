-- CRITICAL SECURITY FIX: Restrict bookings table access to prevent unauthorized access to sensitive customer data
-- Current problem: "Enable guest booking viewing" policy allows public access to guest bookings with payment_intent_id

-- Ensure RLS is enabled
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- Drop the overly permissive guest booking viewing policy that allows public access
DROP POLICY IF EXISTS "Enable guest booking viewing" ON public.bookings;

-- Drop the problematic guest booking updates policy 
DROP POLICY IF EXISTS "Enable guest booking updates" ON public.bookings;

-- Create secure replacement policies

-- 1. Customers can view their own bookings
CREATE POLICY "Customers can view own bookings" ON public.bookings
FOR SELECT 
USING (
  customer_id = auth.uid()
);

-- 2. Workers can view their assigned bookings (keep existing functionality)
CREATE POLICY "Workers can view assigned bookings" ON public.bookings
FOR SELECT 
USING (
  worker_id = auth.uid()
);

-- 3. Secure guest booking access - only allow updates with proper session validation
-- Guest bookings can only be updated by the payment system or admin, not publicly viewable
CREATE POLICY "System can update guest bookings" ON public.bookings
FOR UPDATE 
USING (
  -- Admin access OR service role (for payment processing)
  (auth.uid() IS NOT NULL AND get_current_user_role() = 'admin'::text) OR
  -- Worker assigned to the booking
  (worker_id = auth.uid())
) 
WITH CHECK (
  -- Admin access OR service role (for payment processing) 
  (auth.uid() IS NOT NULL AND get_current_user_role() = 'admin'::text) OR
  -- Worker assigned to the booking
  (worker_id = auth.uid())
);

-- 4. Customers can update their own bookings
CREATE POLICY "Customers can update own bookings" ON public.bookings
FOR UPDATE 
USING (customer_id = auth.uid())
WITH CHECK (customer_id = auth.uid());

-- Keep existing admin policy (already secure)
-- Keep existing guest booking creation policy (INSERT only, no sensitive data exposure)

-- Add comment documenting the security fix
COMMENT ON TABLE public.bookings IS 'Contains sensitive customer data. Access restricted to booking owners, assigned workers, and admins only.';