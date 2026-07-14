
-- Public read for just the payment_first_enabled key (mirrors stripe_mode pattern)
CREATE POLICY "Anyone can read payment_first_enabled setting"
  ON public.app_settings
  FOR SELECT
  TO anon, authenticated
  USING (key = 'payment_first_enabled');

-- Seed the flag row (default OFF)
INSERT INTO public.app_settings (key, value)
VALUES ('payment_first_enabled', 'false')
ON CONFLICT (key) DO NOTHING;
