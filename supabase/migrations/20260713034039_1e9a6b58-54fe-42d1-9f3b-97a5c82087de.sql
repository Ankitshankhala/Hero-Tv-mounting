
-- USERS: split public policy into anon + authenticated, lock anon to id/name only
DROP POLICY IF EXISTS "Public can view active worker info" ON public.users;

CREATE POLICY "Anon can view active workers (basic)"
  ON public.users
  FOR SELECT
  TO anon
  USING (role = 'worker'::user_role AND is_active = true);

CREATE POLICY "Authenticated can view active workers"
  ON public.users
  FOR SELECT
  TO authenticated
  USING (role = 'worker'::user_role AND is_active = true);

-- Column-level lockdown for anon on users
REVOKE SELECT ON public.users FROM anon;
GRANT SELECT (id, name) ON public.users TO anon;

-- COUPONS: split public policy into anon + authenticated, lock anon columns
DROP POLICY IF EXISTS "Public can view active valid coupons" ON public.coupons;

CREATE POLICY "Anon can view active valid coupons"
  ON public.coupons
  FOR SELECT
  TO anon
  USING (is_active = true AND valid_from <= now() AND valid_until >= now());

CREATE POLICY "Authenticated can view active valid coupons"
  ON public.coupons
  FOR SELECT
  TO authenticated
  USING (is_active = true AND valid_from <= now() AND valid_until >= now());

-- Column-level lockdown for anon on coupons
REVOKE SELECT ON public.coupons FROM anon;
GRANT SELECT (
  id, code, discount_type, discount_value,
  max_discount_amount, min_order_amount, valid_until,
  usage_limit_total, usage_count
) ON public.coupons TO anon;
