-- Enable RLS on the new us_zip_codes table
ALTER TABLE public.us_zip_codes ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for us_zip_codes (public read access since it's reference data)
CREATE POLICY "Anyone can view ZIP code data" 
ON public.us_zip_codes 
FOR SELECT 
USING (true);