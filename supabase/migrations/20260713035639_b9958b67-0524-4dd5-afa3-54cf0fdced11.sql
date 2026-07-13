-- 1. Remove hardcoded admin backdoor (captain@ already has role='admin')
DROP POLICY IF EXISTS "Direct admin access" ON public.users;

-- 2. Collapse three identical "view own profile" SELECT policies into one
DROP POLICY IF EXISTS "Enable read access for own profile" ON public.users;
DROP POLICY IF EXISTS "Users can read own profile" ON public.users;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.users;

CREATE POLICY "Users can view own profile"
ON public.users
FOR SELECT
TO authenticated
USING (id = auth.uid());