
-- Create a storage bucket for service images if it doesn't exist
INSERT INTO storage.buckets (id, name, public) 
VALUES ('service-images', 'service-images', true)
ON CONFLICT (id) DO NOTHING;

-- Create policy to allow public read access to service images
CREATE POLICY IF NOT EXISTS "Public Access" ON storage.objects 
FOR SELECT USING (bucket_id = 'service-images');

-- Create policy to allow authenticated users to upload service images
CREATE POLICY IF NOT EXISTS "Authenticated users can upload service images" ON storage.objects 
FOR INSERT WITH CHECK (bucket_id = 'service-images' AND auth.role() = 'authenticated');

-- Create policy to allow authenticated users to update service images
CREATE POLICY IF NOT EXISTS "Authenticated users can update service images" ON storage.objects 
FOR UPDATE USING (bucket_id = 'service-images' AND auth.role() = 'authenticated');

-- Create policy to allow authenticated users to delete service images
CREATE POLICY IF NOT EXISTS "Authenticated users can delete service images" ON storage.objects 
FOR DELETE USING (bucket_id = 'service-images' AND auth.role() = 'authenticated');
