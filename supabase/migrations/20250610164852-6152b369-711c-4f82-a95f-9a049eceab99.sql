
-- Add image_url column to services table to store service pictures
ALTER TABLE services ADD COLUMN image_url TEXT;

-- Create a storage bucket for service images
INSERT INTO storage.buckets (id, name, public) VALUES ('service-images', 'service-images', true);

-- Create policy to allow public read access to service images
CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'service-images');

-- Create policy to allow authenticated users to upload service images
CREATE POLICY "Authenticated users can upload service images" ON storage.objects 
FOR INSERT WITH CHECK (bucket_id = 'service-images' AND auth.role() = 'authenticated');

-- Create policy to allow authenticated users to update service images
CREATE POLICY "Authenticated users can update service images" ON storage.objects 
FOR UPDATE USING (bucket_id = 'service-images' AND auth.role() = 'authenticated');

-- Create policy to allow authenticated users to delete service images
CREATE POLICY "Authenticated users can delete service images" ON storage.objects 
FOR DELETE USING (bucket_id = 'service-images' AND auth.role() = 'authenticated');
