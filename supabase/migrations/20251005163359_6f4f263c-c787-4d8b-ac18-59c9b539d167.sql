-- Allow public read access to basic worker information for active workers with service areas
CREATE POLICY "Public can view active worker basic info"
ON public.users
FOR SELECT
USING (
  role = 'worker' 
  AND is_active = true
  AND EXISTS (
    SELECT 1 FROM public.worker_service_areas
    WHERE worker_id = users.id AND is_active = true
  )
);