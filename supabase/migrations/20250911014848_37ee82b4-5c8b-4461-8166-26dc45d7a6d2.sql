-- Add remaining functions with proper search_path
CREATE OR REPLACE FUNCTION public.clear_polygon_flag_for_area(p_area_id uuid) 
RETURNS void 
LANGUAGE sql
SET search_path = public
AS $$
  UPDATE worker_service_zipcodes
     SET from_polygon = false,
         service_area_id = CASE 
           WHEN service_area_id = p_area_id THEN NULL 
           ELSE service_area_id 
         END
   WHERE service_area_id = p_area_id;

  DELETE FROM worker_service_zipcodes
   WHERE from_manual = false AND from_polygon = false;
$$;

CREATE OR REPLACE FUNCTION public.rebuild_worker_overlay(p_worker uuid) 
RETURNS void 
LANGUAGE sql
SET search_path = public
AS $$
  WITH z AS (
    SELECT zp.geom
    FROM worker_service_zipcodes wsz
    JOIN zip_polygons zp ON zp.zipcode = wsz.zipcode
    WHERE wsz.worker_id = p_worker
  ),
  u AS (
    SELECT ST_Multi(ST_UnaryUnion(ST_Collect(geom))) AS g, COUNT(*) AS n
    FROM z
  )
  INSERT INTO worker_coverage_overlays(worker_id, overlay_geom, zip_count, updated_at)
  SELECT p_worker, u.g, u.n, now()
  FROM u
  ON CONFLICT (worker_id) DO UPDATE
    SET overlay_geom = EXCLUDED.overlay_geom,
        zip_count    = EXCLUDED.zip_count,
        updated_at   = now();
$$;

CREATE OR REPLACE FUNCTION public.rebuild_overlays_for_area_workers(p_area_id uuid) 
RETURNS void 
LANGUAGE sql
SET search_path = public
AS $$
  SELECT rebuild_worker_overlay(wsa.worker_id)
  FROM worker_service_areas wsa
  WHERE wsa.id = p_area_id;
$$;

CREATE OR REPLACE FUNCTION public.trg_wsa_after_ins_upd() 
RETURNS trigger 
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    PERFORM clear_polygon_flag_for_area(NEW.id);
  END IF;

  IF NEW.is_active IS TRUE AND NEW.geom IS NOT NULL THEN
    PERFORM upsert_zip_coverage_for_area(NEW.id);
    PERFORM rebuild_overlays_for_area_workers(NEW.id);
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_wsa_after_del() 
RETURNS trigger 
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  PERFORM clear_polygon_flag_for_area(OLD.id);
  PERFORM rebuild_overlays_for_area_workers(OLD.id);
  RETURN OLD;
END;
$$;

-- Manual ZIP add/remove function
CREATE OR REPLACE FUNCTION public.upsert_manual_zip_coverage(p_worker_id uuid, p_zipcode text, p_add boolean DEFAULT true)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF p_add THEN
    -- Add manual ZIP coverage
    INSERT INTO worker_service_zipcodes (worker_id, zipcode, service_area_id, from_manual, from_polygon)
    VALUES (p_worker_id, p_zipcode, pick_best_area_for_worker_zip(p_worker_id, p_zipcode), true, false)
    ON CONFLICT (worker_id, zipcode) DO UPDATE
    SET from_manual = true,
        service_area_id = COALESCE(worker_service_zipcodes.service_area_id, EXCLUDED.service_area_id);
  ELSE
    -- Remove manual ZIP coverage
    UPDATE worker_service_zipcodes 
    SET from_manual = false
    WHERE worker_id = p_worker_id AND zipcode = p_zipcode;
    
    -- Delete if no longer from any source
    DELETE FROM worker_service_zipcodes
    WHERE worker_id = p_worker_id AND zipcode = p_zipcode 
      AND from_manual = false AND from_polygon = false;
  END IF;
  
  -- Rebuild overlay for this worker
  PERFORM rebuild_worker_overlay(p_worker_id);
END;
$$;