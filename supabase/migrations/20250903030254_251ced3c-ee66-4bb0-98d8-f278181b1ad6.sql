-- Enable real-time for service area tables
ALTER TABLE public.worker_service_areas REPLICA IDENTITY FULL;
ALTER TABLE public.worker_service_zipcodes REPLICA IDENTITY FULL;

-- Add tables to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.worker_service_areas;
ALTER PUBLICATION supabase_realtime ADD TABLE public.worker_service_zipcodes;