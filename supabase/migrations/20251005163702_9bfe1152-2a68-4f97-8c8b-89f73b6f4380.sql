-- Drop the problematic policy that causes infinite recursion
DROP POLICY IF EXISTS "Public can view active worker basic info" ON public.users;

-- Create a simpler policy that doesn't cause recursion
-- Just allow public read access to active workers (no service area check)
CREATE POLICY "Public can view active worker info"
ON public.users
FOR SELECT
USING (
  role = 'worker' 
  AND is_active = true
);