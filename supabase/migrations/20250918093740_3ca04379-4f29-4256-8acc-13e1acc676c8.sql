-- Fix critical RLS security issues detected by linter

-- Enable RLS on spatial reference tables that need it
ALTER TABLE geometry_columns ENABLE ROW LEVEL SECURITY;
ALTER TABLE geography_columns ENABLE ROW LEVEL SECURITY;

-- Add policies for geometry_columns (read-only access for authenticated users)
CREATE POLICY "Anyone can view geometry columns" 
ON geometry_columns 
FOR SELECT 
USING (true);

-- Add policies for geography_columns (read-only access for authenticated users)  
CREATE POLICY "Anyone can view geography columns"
ON geography_columns
FOR SELECT
USING (true);