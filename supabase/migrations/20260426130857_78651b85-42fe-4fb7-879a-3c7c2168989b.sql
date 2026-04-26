-- 1. Settings table (key/value, single source of truth for runtime config)
CREATE TABLE public.app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Anyone (including anon) can read settings — needed so the frontend can pick
-- the correct publishable Stripe key before login.
CREATE POLICY "Anyone can read app settings"
ON public.app_settings
FOR SELECT
USING (true);

-- Only admins can insert/update/delete settings.
CREATE POLICY "Admins can manage app settings"
ON public.app_settings
FOR ALL
USING (get_current_user_role() = 'admin')
WITH CHECK (get_current_user_role() = 'admin');

-- 2. Audit table
CREATE TABLE public.app_settings_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT NOT NULL,
  changed_by UUID,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.app_settings_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view settings audit"
ON public.app_settings_audit
FOR SELECT
USING (get_current_user_role() = 'admin');

CREATE POLICY "System can insert settings audit"
ON public.app_settings_audit
FOR INSERT
WITH CHECK (true);

-- 3. Audit trigger
CREATE OR REPLACE FUNCTION public.log_app_settings_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.value IS DISTINCT FROM NEW.value THEN
    INSERT INTO public.app_settings_audit (key, old_value, new_value, changed_by)
    VALUES (NEW.key, OLD.value, NEW.value, NEW.updated_by);
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO public.app_settings_audit (key, old_value, new_value, changed_by)
    VALUES (NEW.key, NULL, NEW.value, NEW.updated_by);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_app_settings_audit
AFTER INSERT OR UPDATE ON public.app_settings
FOR EACH ROW
EXECUTE FUNCTION public.log_app_settings_change();

-- 4. Touch updated_at on update
CREATE OR REPLACE FUNCTION public.touch_app_settings_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_app_settings_touch
BEFORE UPDATE ON public.app_settings
FOR EACH ROW
EXECUTE FUNCTION public.touch_app_settings_updated_at();

-- 5. Seed the Stripe mode (default: live, never accidentally test)
INSERT INTO public.app_settings (key, value)
VALUES ('stripe_mode', 'live')
ON CONFLICT (key) DO NOTHING;