-- Add admin access policies for worker service areas
CREATE POLICY "Admins can manage all worker service areas" 
ON public.worker_service_areas 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Admins can manage all worker service zipcodes" 
ON public.worker_service_zipcodes 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Create service area audit logs table
CREATE TABLE public.service_area_audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  table_name TEXT NOT NULL,
  operation TEXT NOT NULL, -- INSERT, UPDATE, DELETE
  record_id UUID NOT NULL,
  old_data JSONB,
  new_data JSONB,
  changed_by UUID REFERENCES auth.users(id),
  changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  worker_id UUID NOT NULL,
  area_name TEXT,
  change_summary TEXT
);

-- Enable RLS on audit logs
ALTER TABLE public.service_area_audit_logs ENABLE ROW LEVEL SECURITY;

-- Allow admins and workers to view relevant audit logs
CREATE POLICY "Admins can view all service area audit logs" 
ON public.service_area_audit_logs 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Workers can view their own service area audit logs" 
ON public.service_area_audit_logs 
FOR SELECT 
USING (worker_id = auth.uid());

-- Function to create audit log entries
CREATE OR REPLACE FUNCTION public.create_service_area_audit_log(
  p_table_name TEXT,
  p_operation TEXT,
  p_record_id UUID,
  p_old_data JSONB DEFAULT NULL,
  p_new_data JSONB DEFAULT NULL,
  p_worker_id UUID DEFAULT NULL,
  p_area_name TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  audit_id UUID;
  summary_text TEXT;
BEGIN
  -- Generate change summary
  IF p_operation = 'INSERT' THEN
    summary_text := 'Created service area: ' || COALESCE(p_area_name, 'Unnamed Area');
  ELSIF p_operation = 'UPDATE' THEN
    summary_text := 'Updated service area: ' || COALESCE(p_area_name, 'Unnamed Area');
  ELSIF p_operation = 'DELETE' THEN
    summary_text := 'Deleted service area: ' || COALESCE(p_area_name, 'Unnamed Area');
  END IF;
  
  INSERT INTO public.service_area_audit_logs (
    table_name, operation, record_id, old_data, new_data, 
    changed_by, worker_id, area_name, change_summary
  ) VALUES (
    p_table_name, p_operation, p_record_id, p_old_data, p_new_data,
    auth.uid(), p_worker_id, p_area_name, summary_text
  ) RETURNING id INTO audit_id;
  
  RETURN audit_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Triggers for audit logging on worker_service_areas
CREATE OR REPLACE FUNCTION public.audit_worker_service_areas() 
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.create_service_area_audit_log(
      'worker_service_areas', 'INSERT', NEW.id, 
      NULL, row_to_json(NEW)::jsonb, NEW.worker_id, NEW.area_name
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM public.create_service_area_audit_log(
      'worker_service_areas', 'UPDATE', NEW.id, 
      row_to_json(OLD)::jsonb, row_to_json(NEW)::jsonb, NEW.worker_id, NEW.area_name
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.create_service_area_audit_log(
      'worker_service_areas', 'DELETE', OLD.id, 
      row_to_json(OLD)::jsonb, NULL, OLD.worker_id, OLD.area_name
    );
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trigger_audit_worker_service_areas
  AFTER INSERT OR UPDATE OR DELETE ON public.worker_service_areas
  FOR EACH ROW EXECUTE FUNCTION public.audit_worker_service_areas();

-- Function to get workers for admin selection
CREATE OR REPLACE FUNCTION public.get_workers_for_admin()
RETURNS TABLE(
  id UUID,
  name TEXT,
  email TEXT,
  is_active BOOLEAN,
  service_area_count INTEGER,
  total_zipcodes INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id,
    u.name,
    u.email,
    u.is_active,
    COALESCE(area_stats.area_count, 0)::INTEGER as service_area_count,
    COALESCE(area_stats.zipcode_count, 0)::INTEGER as total_zipcodes
  FROM public.users u
  LEFT JOIN (
    SELECT 
      wsa.worker_id,
      COUNT(DISTINCT wsa.id) as area_count,
      COUNT(DISTINCT wsz.zipcode) as zipcode_count
    FROM public.worker_service_areas wsa
    LEFT JOIN public.worker_service_zipcodes wsz ON wsa.id = wsz.service_area_id
    WHERE wsa.is_active = true
    GROUP BY wsa.worker_id
  ) area_stats ON u.id = area_stats.worker_id
  WHERE u.role = 'worker'
  ORDER BY u.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;