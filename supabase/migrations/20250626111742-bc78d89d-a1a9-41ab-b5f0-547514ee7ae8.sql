
-- Add RLS policies for services table to allow public read access
-- This will fix the "failed to load services" error

-- Enable RLS on services table if not already enabled
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

-- Allow everyone to read active and visible services (for public display)
CREATE POLICY "Enable public read access for active services" ON public.services
FOR SELECT USING (is_active = true AND is_visible = true);

-- Allow admins full access to services
CREATE POLICY "Enable admin full access to services" ON public.services
FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

-- Allow workers to read all services (for booking creation)
CREATE POLICY "Enable worker read access to services" ON public.services
FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'worker')
    OR is_active = true
);
