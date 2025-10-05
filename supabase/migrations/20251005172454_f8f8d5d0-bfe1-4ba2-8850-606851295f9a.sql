-- Create public storage bucket for ZCTA GeoJSON data
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'zcta-data',
  'zcta-data',
  true,
  524288000, -- 500MB limit for large GeoJSON files
  ARRAY['application/json', 'application/geo+json']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 524288000,
  allowed_mime_types = ARRAY['application/json', 'application/geo+json'];

-- Create RLS policy for public read access
CREATE POLICY "Public read access for ZCTA data"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'zcta-data');

-- Create RLS policy for authenticated uploads
CREATE POLICY "Authenticated users can upload ZCTA data"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'zcta-data');