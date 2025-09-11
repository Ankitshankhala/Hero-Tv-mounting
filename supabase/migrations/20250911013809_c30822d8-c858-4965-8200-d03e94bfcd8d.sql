-- Ensure PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- Add spatial geometry column to worker_service_areas for polygon storage
ALTER TABLE public.worker_service_areas
  ADD COLUMN IF NOT EXISTS geom geometry(MultiPolygon, 4326);

-- Create spatial index for worker_service_areas
CREATE INDEX IF NOT EXISTS idx_worker_service_areas_geom
  ON public.worker_service_areas USING GIST (geom);

-- Ensure zip_polygons has spatial index (assuming this table exists)
CREATE INDEX IF NOT EXISTS idx_zip_polygons_geom
  ON public.zip_polygons USING GIST (geom);

-- Make service_area_id nullable in worker_service_zipcodes (for manual entries)
ALTER TABLE public.worker_service_zipcodes
  ALTER COLUMN service_area_id DROP NOT NULL;

-- Add dual-source flags to worker_service_zipcodes
ALTER TABLE public.worker_service_zipcodes
  ADD COLUMN IF NOT EXISTS from_manual boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS from_polygon boolean NOT NULL DEFAULT false;

-- Add unique constraint to prevent duplicate (worker_id, zipcode) rows
ALTER TABLE public.worker_service_zipcodes
  ADD CONSTRAINT uq_wsz_worker_zip UNIQUE (worker_id, zipcode);

-- Add proper foreign key constraints
ALTER TABLE public.worker_service_zipcodes
  ADD CONSTRAINT fk_wsz_worker
    FOREIGN KEY (worker_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.worker_service_zipcodes
  ADD CONSTRAINT fk_wsz_service_area
    FOREIGN KEY (service_area_id) REFERENCES public.worker_service_areas(id) ON DELETE SET NULL;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_wsz_zipcode ON public.worker_service_zipcodes(zipcode);
CREATE INDEX IF NOT EXISTS idx_wsz_worker ON public.worker_service_zipcodes(worker_id);

-- Create materialized coverage overlay table for fast map display
CREATE TABLE IF NOT EXISTS public.worker_coverage_overlays (
  worker_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  overlay_geom geometry(MultiPolygon, 4326),
  zip_count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_worker_coverage_overlays_geom
  ON public.worker_coverage_overlays USING GIST (overlay_geom);

-- Helper function: pick best area for a worker+ZIP (largest overlap)
CREATE OR REPLACE FUNCTION public.pick_best_area_for_worker_zip(p_worker uuid, p_zip text)
RETURNS uuid 
LANGUAGE sql STABLE
AS $$
  SELECT wsa.id
  FROM public.worker_service_areas wsa
  JOIN public.zip_polygons zp ON zp.zipcode = p_zip
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
AS $$
  INSERT INTO public.worker_service_zipcodes (worker_id, service_area_id, zipcode, from_manual, from_polygon)
  SELECT wsa.worker_id, wsa.id, zp.zipcode, false, true
  FROM public.worker_service_areas wsa
  JOIN public.zip_polygons zp ON ST_Intersects(wsa.geom, zp.geom)
  WHERE wsa.id = p_area_id
  ON CONFLICT (worker_id, zipcode) DO UPDATE
    SET from_polygon = true,
        service_area_id = COALESCE(worker_service_zipcodes.service_area_id, EXCLUDED.service_area_id);
$$;

-- Function: clear polygon flag for area (on update/delete)
CREATE OR REPLACE FUNCTION public.clear_polygon_flag_for_area(p_area_id uuid) 
RETURNS void 
LANGUAGE sql
AS $$
  UPDATE public.worker_service_zipcodes
     SET from_polygon = false,
         service_area_id = CASE 
           WHEN service_area_id = p_area_id THEN NULL 
           ELSE service_area_id 
         END
   WHERE service_area_id = p_area_id;

  DELETE FROM public.worker_service_zipcodes
   WHERE from_manual = false AND from_polygon = false;
$$;

-- Function: rebuild worker coverage overlay (union of all assigned ZIPs)
CREATE OR REPLACE FUNCTION public.rebuild_worker_overlay(p_worker uuid) 
RETURNS void 
LANGUAGE sql
AS $$
  WITH z AS (
    SELECT zp.geom
    FROM public.worker_service_zipcodes wsz
    JOIN public.zip_polygons zp ON zp.zipcode = wsz.zipcode
    WHERE wsz.worker_id = p_worker
  ),
  u AS (
    SELECT ST_Multi(ST_UnaryUnion(ST_Collect(geom))) AS g, COUNT(*) AS n
    FROM z
  )
  INSERT INTO public.worker_coverage_overlays(worker_id, overlay_geom, zip_count, updated_at)
  SELECT p_worker, u.g, u.n, now()
  FROM u
  ON CONFLICT (worker_id) DO UPDATE
    SET overlay_geom = EXCLUDED.overlay_geom,
        zip_count    = EXCLUDED.zip_count,
        updated_at   = now();
$$;

-- Function: rebuild overlays for workers affected by area changes
CREATE OR REPLACE FUNCTION public.rebuild_overlays_for_area_workers(p_area_id uuid) 
RETURNS void 
LANGUAGE sql
AS $$
  SELECT public.rebuild_worker_overlay(wsa.worker_id)
  FROM public.worker_service_areas wsa
  WHERE wsa.id = p_area_id;
$$;

-- Trigger function for worker_service_areas insert/update
CREATE OR REPLACE FUNCTION public.trg_wsa_after_ins_upd() 
RETURNS trigger 
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    PERFORM public.clear_polygon_flag_for_area(NEW.id);
  END IF;

  IF NEW.is_active IS TRUE AND NEW.geom IS NOT NULL THEN
    PERFORM public.upsert_zip_coverage_for_area(NEW.id);
    PERFORM public.rebuild_overlays_for_area_workers(NEW.id);
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger function for worker_service_areas delete
CREATE OR REPLACE FUNCTION public.trg_wsa_after_del() 
RETURNS trigger 
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM public.clear_polygon_flag_for_area(OLD.id);
  PERFORM public.rebuild_overlays_for_area_workers(OLD.id);
  RETURN OLD;
END;
$$;

-- Create triggers
DROP TRIGGER IF EXISTS wsa_after_ins_upd ON public.worker_service_areas;
CREATE TRIGGER wsa_after_ins_upd
AFTER INSERT OR UPDATE OF geom, is_active ON public.worker_service_areas
FOR EACH ROW EXECUTE FUNCTION public.trg_wsa_after_ins_upd();

DROP TRIGGER IF EXISTS wsa_after_del ON public.worker_service_areas;
CREATE TRIGGER wsa_after_del
AFTER DELETE ON public.worker_service_areas
FOR EACH ROW EXECUTE FUNCTION public.trg_wsa_after_del();

-- Function: get workers covering a ZIP (for booking auto-assignment)
CREATE OR REPLACE FUNCTION public.get_workers_for_zipcode(p_zipcode text)
RETURNS TABLE(worker_id uuid, worker_name text, worker_email text)
LANGUAGE sql STABLE
AS $$
  SELECT DISTINCT u.id, u.name, u.email
  FROM public.worker_service_zipcodes wsz
  JOIN public.users u ON u.id = wsz.worker_id
  WHERE wsz.zipcode = p_zipcode
    AND u.role = 'worker'::user_role
    AND u.is_active IS TRUE
  ORDER BY u.name;
$$;

-- Function: manual ZIP add/remove with overlay rebuild
CREATE OR REPLACE FUNCTION public.upsert_manual_zip_coverage(p_worker_id uuid, p_zipcode text, p_add boolean DEFAULT true)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_add THEN
    -- Add manual ZIP coverage
    INSERT INTO public.worker_service_zipcodes (worker_id, zipcode, service_area_id, from_manual, from_polygon)
    VALUES (p_worker_id, p_zipcode, public.pick_best_area_for_worker_zip(p_worker_id, p_zipcode), true, false)
    ON CONFLICT (worker_id, zipcode) DO UPDATE
    SET from_manual = true,
        service_area_id = COALESCE(worker_service_zipcodes.service_area_id, EXCLUDED.service_area_id);
  ELSE
    -- Remove manual ZIP coverage
    UPDATE public.worker_service_zipcodes 
    SET from_manual = false
    WHERE worker_id = p_worker_id AND zipcode = p_zipcode;
    
    -- Delete if no longer from any source
    DELETE FROM public.worker_service_zipcodes
    WHERE worker_id = p_worker_id AND zipcode = p_zipcode 
      AND from_manual = false AND from_polygon = false;
  END IF;
  
  -- Rebuild overlay for this worker
  PERFORM public.rebuild_worker_overlay(p_worker_id);
END;
$$;