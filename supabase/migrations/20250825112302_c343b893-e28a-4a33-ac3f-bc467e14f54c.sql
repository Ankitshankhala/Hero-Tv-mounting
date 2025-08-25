-- Create tables for worker service areas and zip codes
CREATE TABLE public.worker_service_areas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  worker_id UUID NOT NULL,
  area_name TEXT NOT NULL DEFAULT 'Service Area',
  polygon_coordinates JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_active BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE public.worker_service_zipcodes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  worker_id UUID NOT NULL,
  service_area_id UUID NOT NULL,
  zipcode TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.worker_service_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worker_service_zipcodes ENABLE ROW LEVEL SECURITY;

-- Create policies for worker_service_areas
CREATE POLICY "Workers can manage their own service areas"
ON public.worker_service_areas
FOR ALL
USING (worker_id = auth.uid())
WITH CHECK (worker_id = auth.uid());

CREATE POLICY "Admins can view all service areas"
ON public.worker_service_areas
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.users 
  WHERE id = auth.uid() AND role = 'admin'
));

CREATE POLICY "System can view service areas for assignment"
ON public.worker_service_areas
FOR SELECT
USING (is_active = true);

-- Create policies for worker_service_zipcodes
CREATE POLICY "Workers can manage their own service zip codes"
ON public.worker_service_zipcodes
FOR ALL
USING (worker_id = auth.uid())
WITH CHECK (worker_id = auth.uid());

CREATE POLICY "Admins can view all service zip codes"
ON public.worker_service_zipcodes
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.users 
  WHERE id = auth.uid() AND role = 'admin'
));

CREATE POLICY "System can view zip codes for assignment"
ON public.worker_service_zipcodes
FOR SELECT
USING (true);

-- Create indexes for performance
CREATE INDEX idx_worker_service_areas_worker_id ON public.worker_service_areas(worker_id);
CREATE INDEX idx_worker_service_areas_active ON public.worker_service_areas(is_active) WHERE is_active = true;
CREATE INDEX idx_worker_service_zipcodes_worker_id ON public.worker_service_zipcodes(worker_id);
CREATE INDEX idx_worker_service_zipcodes_zipcode ON public.worker_service_zipcodes(zipcode);
CREATE INDEX idx_worker_service_zipcodes_area_id ON public.worker_service_zipcodes(service_area_id);

-- Add trigger to update updated_at
CREATE TRIGGER update_worker_service_areas_updated_at
  BEFORE UPDATE ON public.worker_service_areas
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Update the find_available_workers function to use polygon-based zip codes
CREATE OR REPLACE FUNCTION public.find_available_workers_polygon(
  customer_zipcode TEXT,
  service_date DATE,
  service_start_time TIME,
  service_duration_minutes INTEGER DEFAULT 60
)
RETURNS TABLE(
  worker_id UUID,
  distance_priority INTEGER,
  worker_name TEXT,
  worker_email TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id as worker_id,
    1 as distance_priority, -- All workers in polygon have same priority
    u.name as worker_name,
    u.email as worker_email
  FROM public.users u
  WHERE u.role = 'worker'
    AND u.is_active = true
    AND EXISTS (
      -- Check if worker has polygon-based service area covering this zip code
      SELECT 1 
      FROM public.worker_service_zipcodes wsz
      INNER JOIN public.worker_service_areas wsa ON wsz.service_area_id = wsa.id
      WHERE wsz.worker_id = u.id 
        AND wsz.zipcode = customer_zipcode
        AND wsa.is_active = true
    )
    AND EXISTS (
      -- Check if worker is available on this day/time
      SELECT 1 
      FROM public.worker_availability wa
      WHERE wa.worker_id = u.id
        AND wa.day_of_week = EXTRACT(DOW FROM service_date)::day_of_week
        AND wa.start_time <= service_start_time
        AND wa.end_time >= (service_start_time + (service_duration_minutes || ' minutes')::INTERVAL)::TIME
    )
    AND NOT EXISTS (
      -- Check for conflicting bookings
      SELECT 1 
      FROM public.bookings b
      WHERE b.worker_id = u.id
        AND b.scheduled_date = service_date
        AND b.status IN ('confirmed', 'completed', 'payment_authorized')
        AND (
          (b.scheduled_start <= service_start_time AND 
           (b.scheduled_start + INTERVAL '60 minutes') > service_start_time) OR
          (service_start_time <= b.scheduled_start AND 
           (service_start_time + (service_duration_minutes || ' minutes')::INTERVAL) > b.scheduled_start)
        )
    )
  ORDER BY u.name;
END;
$$;