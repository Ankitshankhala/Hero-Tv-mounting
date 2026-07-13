DROP POLICY IF EXISTS "Enable guest booking services viewing" ON public.booking_services;

DROP POLICY IF EXISTS "Anyone can read app settings" ON public.app_settings;

CREATE POLICY "Anyone can read stripe_mode setting"
ON public.app_settings
FOR SELECT
TO anon, authenticated
USING (key = 'stripe_mode');