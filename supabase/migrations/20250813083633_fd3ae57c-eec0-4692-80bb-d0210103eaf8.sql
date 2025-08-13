-- CRITICAL SECURITY FIX: Clean up conflicting worker applications policies
-- Current issue: Multiple overlapping policies could create security vulnerabilities
-- This contains sensitive PII that must be protected from unauthorized access

-- Ensure RLS is enabled
ALTER TABLE public.worker_applications ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies to clean slate (they will be recreated securely)
DROP POLICY IF EXISTS "Admins can manage all worker applications" ON public.worker_applications;
DROP POLICY IF EXISTS "Admins can update worker applications" ON public.worker_applications;
DROP POLICY IF EXISTS "Admins can view all worker applications" ON public.worker_applications;
DROP POLICY IF EXISTS "Anyone can create worker applications" ON public.worker_applications;
DROP POLICY IF EXISTS "Anyone can insert worker applications" ON public.worker_applications;
DROP POLICY IF EXISTS "Only admins can view worker applications" ON public.worker_applications;

-- Create secure, non-conflicting policies

-- 1. Allow anonymous application submission (required for worker signup)
CREATE POLICY "Enable worker application submission" ON public.worker_applications
FOR INSERT 
WITH CHECK (true);

-- 2. Only admins can view worker applications (contains sensitive PII)
CREATE POLICY "Admins only can view applications" ON public.worker_applications
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE users.id = auth.uid() 
    AND users.role = 'admin'::user_role
  )
);

-- 3. Only admins can update application status
CREATE POLICY "Admins only can update applications" ON public.worker_applications
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE users.id = auth.uid() 
    AND users.role = 'admin'::user_role
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE users.id = auth.uid() 
    AND users.role = 'admin'::user_role
  )
);

-- 4. Only admins can delete applications
CREATE POLICY "Admins only can delete applications" ON public.worker_applications
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE users.id = auth.uid() 
    AND users.role = 'admin'::user_role
  )
);

-- Add security documentation
COMMENT ON TABLE public.worker_applications IS 'Contains sensitive applicant PII (names, emails, phones, addresses). Access strictly limited to admin users only to prevent identity theft and unauthorized data access.';