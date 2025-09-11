-- Fix security issues for new tables by enabling RLS
ALTER TABLE public.us_zcta_polygons ENABLE ROW LEVEL SECURITY;

-- Allow public read access to ZCTA polygons (this is geographic reference data)
CREATE POLICY "Anyone can view ZCTA polygons" 
ON public.us_zcta_polygons 
FOR SELECT 
USING (true);