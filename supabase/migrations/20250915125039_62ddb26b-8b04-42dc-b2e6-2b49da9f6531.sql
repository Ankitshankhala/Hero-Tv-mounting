-- Create upload_chunks_metadata table for tracking chunk uploads
CREATE TABLE public.upload_chunks_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_id TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  total_chunks INTEGER NOT NULL,
  chunk_path TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  assembled_file_path TEXT,
  data_type TEXT DEFAULT 'zcta_polygons',
  progress_current INTEGER DEFAULT 0,
  progress_total INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(upload_id, chunk_index)
);

-- Create storage bucket for temporary uploads
INSERT INTO storage.buckets (id, name, public) VALUES ('temp-uploads', 'temp-uploads', true);

-- Create RLS policies for upload_chunks_metadata
ALTER TABLE public.upload_chunks_metadata ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all upload chunks" 
ON public.upload_chunks_metadata 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM users 
  WHERE users.id = auth.uid() AND users.role = 'admin'::user_role
));

CREATE POLICY "Service role can manage upload chunks" 
ON public.upload_chunks_metadata 
FOR ALL 
USING (auth.role() = 'service_role');

-- Create storage policies for temp-uploads bucket
CREATE POLICY "Admins can upload temp files" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'temp-uploads' AND EXISTS (
  SELECT 1 FROM users 
  WHERE users.id = auth.uid() AND users.role = 'admin'::user_role
));

CREATE POLICY "Admins can view temp files" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'temp-uploads' AND EXISTS (
  SELECT 1 FROM users 
  WHERE users.id = auth.uid() AND users.role = 'admin'::user_role
));

CREATE POLICY "Public can view temp files" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'temp-uploads');

CREATE POLICY "Service role can manage temp files" 
ON storage.objects 
FOR ALL 
USING (bucket_id = 'temp-uploads' AND auth.role() = 'service_role');

-- Add trigger to update updated_at timestamp
CREATE TRIGGER update_upload_chunks_metadata_updated_at
  BEFORE UPDATE ON public.upload_chunks_metadata
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();