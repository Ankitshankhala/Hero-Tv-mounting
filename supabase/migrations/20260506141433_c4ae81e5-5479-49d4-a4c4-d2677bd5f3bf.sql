-- 1. Prevent privilege escalation on users.role / users.is_active
CREATE OR REPLACE FUNCTION public.prevent_role_self_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_role text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT role::text INTO current_role FROM public.users WHERE id = auth.uid();
  IF current_role IS DISTINCT FROM 'admin' THEN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'Only admins can change user role';
    END IF;
    IF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
      RAISE EXCEPTION 'Only admins can change is_active';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_role_self_escalation ON public.users;
CREATE TRIGGER trg_prevent_role_self_escalation
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_role_self_escalation();

-- 2. Remove broad public ALL on idempotency_records (service_role bypasses RLS)
DROP POLICY IF EXISTS "Service role can manage idempotency records" ON public.idempotency_records;

-- 3. Remove broad public ALL on worker_service_zipcodes
DROP POLICY IF EXISTS "System functions can manage worker service zipcodes" ON public.worker_service_zipcodes;

-- 4. Remove anonymous public read on worker_schedule
DROP POLICY IF EXISTS "Anyone can view worker schedules" ON public.worker_schedule;

-- 5. Audit log INSERT restricted to service_role
DROP POLICY IF EXISTS "System can insert audit logs" ON public.booking_audit_log;
CREATE POLICY "Service role can insert audit logs"
  ON public.booking_audit_log
  FOR INSERT TO service_role
  WITH CHECK (true);

DROP POLICY IF EXISTS "System can insert audit log" ON public.coupon_audit_log;
CREATE POLICY "Service role can insert coupon audit log"
  ON public.coupon_audit_log
  FOR INSERT TO service_role
  WITH CHECK (true);

DROP POLICY IF EXISTS "System can insert settings audit" ON public.app_settings_audit;
CREATE POLICY "Service role can insert settings audit"
  ON public.app_settings_audit
  FOR INSERT TO service_role
  WITH CHECK (true);

-- 6. Restrict service-images UPDATE/DELETE to admins
DROP POLICY IF EXISTS "Authenticated users can delete service images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update service images" ON storage.objects;

CREATE POLICY "Admins can delete service images"
  ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'service-images'
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid() AND users.role = 'admin'::user_role
    )
  );

CREATE POLICY "Admins can update service images"
  ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'service-images'
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid() AND users.role = 'admin'::user_role
    )
  );