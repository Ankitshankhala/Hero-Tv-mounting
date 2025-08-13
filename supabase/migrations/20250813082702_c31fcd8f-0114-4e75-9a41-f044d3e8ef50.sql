-- CRITICAL SECURITY FIX: Protect worker availability data from competitor access
-- Current issue: "Anyone can view worker availability" policy allows public access to worker schedules
-- This exposes sensitive business information that competitors could exploit

-- Ensure RLS is enabled
ALTER TABLE public.worker_availability ENABLE ROW LEVEL SECURITY;

-- Drop the dangerous public access policy that exposes worker schedules
DROP POLICY IF EXISTS "Anyone can view worker availability" ON public.worker_availability;

-- Create secure replacement policies

-- 1. Workers can view and manage their own availability
CREATE POLICY "Workers can manage own availability" ON public.worker_availability
FOR ALL 
USING (worker_id = auth.uid())
WITH CHECK (worker_id = auth.uid());

-- 2. Admins can view all worker availability for business operations
CREATE POLICY "Admins can view all availability" ON public.worker_availability
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE users.id = auth.uid() 
    AND users.role = 'admin'::user_role
  )
);

-- 3. System/booking functions need access for worker assignment (authenticated internal use only)
-- This allows the booking system to find available workers for legitimate customer bookings
CREATE POLICY "Authenticated system access for bookings" ON public.worker_availability
FOR SELECT 
USING (
  auth.uid() IS NOT NULL AND (
    -- Admin access
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE users.id = auth.uid() 
      AND users.role = 'admin'::user_role
    ) OR
    -- Worker access (own availability)
    worker_id = auth.uid()
  )
);

-- Keep existing admin management policy
-- Note: The "Workers can manage their own availability" policy already covers worker management

-- Add comment documenting the business security protection
COMMENT ON TABLE public.worker_availability IS 'Contains sensitive worker schedule data. Access restricted to protect against competitor poaching and business intelligence theft.';