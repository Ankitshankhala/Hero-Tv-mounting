
-- Update the "Direct admin access" RLS policy to use the new email
DROP POLICY IF EXISTS "Direct admin access" ON public.users;

CREATE POLICY "Direct admin access"
ON public.users
FOR ALL
USING ((auth.jwt() ->> 'email'::text) = 'captain@herotvmounting.com'::text);
