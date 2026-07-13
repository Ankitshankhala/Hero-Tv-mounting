-- 1. Admin-only view that returns full worker rows (with PII) only when the caller is admin.
--    Uses SECURITY DEFINER-like behavior: the view is SQL, but the get_current_user_role()
--    predicate is evaluated at query time; non-admins receive zero rows.
CREATE OR REPLACE VIEW public.admin_worker_directory
WITH (security_invoker = true) AS
SELECT
  u.id, u.email, u.name, u.phone, u.city, u.zip_code,
  u.latitude, u.longitude, u.reason, u.role, u.is_active,
  u.created_at, u.updated_at,
  u.stripe_customer_id, u.stripe_default_payment_method_id, u.has_saved_card
FROM public.users u
WHERE public.get_current_user_role() = 'admin';

GRANT SELECT ON public.admin_worker_directory TO authenticated;

-- 2. SECURITY DEFINER function so any authenticated user can fetch their own full profile row,
--    which is required after we column-restrict the base table below.
CREATE OR REPLACE FUNCTION public.get_my_profile()
RETURNS public.users
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.users WHERE id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.get_my_profile() TO authenticated;

-- 3. Column-restrict direct SELECT on public.users for the authenticated role.
--    Only columns needed for legitimate cross-role reads (e.g. customer dashboard's
--    worker:users!worker_id(name, phone) join) remain readable via the base table.
REVOKE SELECT ON public.users FROM authenticated;
GRANT SELECT (id, name, phone, city, role, is_active) ON public.users TO authenticated;

-- Note: service_role retains full access (GRANT ALL was granted earlier and is unaffected
-- by column-scoped GRANTs to authenticated). Admin components will read PII columns
-- via public.admin_worker_directory. Users' own full-row reads use public.get_my_profile().