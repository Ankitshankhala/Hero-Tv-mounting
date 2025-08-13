-- SECURITY FIX: Protect worker application data from unauthorized access
-- Current issue: Missing SELECT policies allowing potential public read access to sensitive applicant data

-- Ensure RLS is enabled on worker_applications table
ALTER TABLE public.worker_applications ENABLE ROW LEVEL SECURITY;

-- The table currently has:
-- - Public INSERT policies (good - allows applications)
-- - Admin management policies (good - allows admin review)
-- - Missing SELECT restrictions (security issue)

-- Add secure SELECT policy: Only admins can view worker applications
-- This prevents unauthorized access to sensitive applicant data (names, emails, phones, etc.)
CREATE POLICY "Only admins can view worker applications" ON public.worker_applications
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE users.id = auth.uid() 
    AND users.role = 'admin'::user_role
  )
);

-- Keep existing policies:
-- - "Anyone can create worker applications" (INSERT) - allows job applications
-- - "Admins can manage all worker applications" (ALL) - admin functionality
-- - Other admin policies remain unchanged

-- Add comment documenting the security protection
COMMENT ON TABLE public.worker_applications IS 'Contains sensitive applicant data (names, emails, phones). Only admins can view applications to protect privacy.';