-- ================================================
-- FIX: Services Table RLS Policy Conflicts
-- Remove duplicate/overlapping policies
-- Keep only 2 essential policies
-- ================================================

-- Step 1: Drop all existing policies
DROP POLICY IF EXISTS "Admins can manage all services" ON public.services;
DROP POLICY IF EXISTS "Admins can manage services" ON public.services;
DROP POLICY IF EXISTS "Anyone can view active services" ON public.services;
DROP POLICY IF EXISTS "Enable admin full access to services" ON public.services;
DROP POLICY IF EXISTS "Enable public read access for active services" ON public.services;
DROP POLICY IF EXISTS "Enable worker read access to services" ON public.services;

-- Step 2: Create clean, non-conflicting policies

-- Policy 1: Public read access for active & visible services
CREATE POLICY "public_read_active_services" 
ON public.services
FOR SELECT
TO anon, authenticated
USING (
  is_active = true 
  AND is_visible = true
);

-- Policy 2: Admin full access (all operations)
CREATE POLICY "admin_full_access_services" 
ON public.services
FOR ALL
TO authenticated
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

-- Step 3: Add documentation
COMMENT ON POLICY "public_read_active_services" ON public.services IS 
  'Allows anonymous and authenticated users to view active, visible services';
COMMENT ON POLICY "admin_full_access_services" ON public.services IS 
  'Allows admin users full CRUD access to all services';