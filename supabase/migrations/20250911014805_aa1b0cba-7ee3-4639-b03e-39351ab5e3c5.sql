-- Enable RLS on the new coverage overlay table
ALTER TABLE public.worker_coverage_overlays ENABLE ROW LEVEL SECURITY;

-- RLS policy for worker_coverage_overlays
CREATE POLICY "Admins can manage all worker coverage overlays" 
ON public.worker_coverage_overlays 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM users 
  WHERE users.id = auth.uid() AND users.role = 'admin'::user_role
));

CREATE POLICY "Workers can view their own coverage overlay" 
ON public.worker_coverage_overlays 
FOR SELECT 
USING (worker_id = auth.uid());

-- Helper functions with proper search_path
CREATE OR REPLACE FUNCTION public.pick_best_area_for_worker_zip(p_worker uuid, p_zip text)
RETURNS uuid 
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT wsa.id
  FROM worker_service_areas wsa
  JOIN zip_polygons zp ON zp.zipcode = p_zip
  WHERE wsa.worker_id = p_worker
    AND wsa.is_active IS TRUE
    AND wsa.geom IS NOT NULL
    AND ST_Intersects(wsa.geom, zp.geom)
  ORDER BY ST_Area(ST_Intersection(wsa.geom, zp.geom)) DESC
  LIMIT 1;
$$;

-- Function: upsert ZIP coverage for polygon area
CREATE OR REPLACE FUNCTION public.upsert_zip_coverage_for_area(p_area_id uuid) 
RETURNS void 
LANGUAGE sql
SET search_path = public
AS $$
  INSERT INTO worker_service_zipcodes (worker_id, service_area_id, zipcode, from_manual, from_polygon)
  SELECT wsa.worker_id, wsa.id, zp.zipcode, false, true
  FROM worker_service_areas wsa
  JOIN zip_polygons zp ON ST_Intersects(wsa.geom, zp.geom)
  WHERE wsa.id = p_area_id
  ON CONFLICT (worker_id, zipcode) DO UPDATE
    SET from_polygon = true,
        service_area_id = COALESCE(worker_service_zipcodes.service_area_id, EXCLUDED.service_area_id);
$$;