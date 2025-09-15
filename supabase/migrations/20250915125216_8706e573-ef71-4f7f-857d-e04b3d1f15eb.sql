-- Enable RLS on missing tables that were detected
ALTER TABLE public.geography_columns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.geometry_columns ENABLE ROW LEVEL SECURITY;

-- Create policies for these system tables (they can be read-only for authenticated users)
CREATE POLICY "Allow read access to geography_columns" 
ON public.geography_columns 
FOR SELECT 
USING (true);

CREATE POLICY "Allow read access to geometry_columns" 
ON public.geometry_columns 
FOR SELECT 
USING (true);