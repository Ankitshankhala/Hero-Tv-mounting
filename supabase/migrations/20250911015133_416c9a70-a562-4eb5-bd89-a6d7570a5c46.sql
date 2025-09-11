-- Fix RLS policies for worker_service_zipcodes to allow function access
CREATE POLICY "System functions can manage worker service zipcodes" 
ON public.worker_service_zipcodes 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Make the functions SECURITY DEFINER so they can bypass RLS
CREATE OR REPLACE FUNCTION public.backfill_worker_service_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Mark existing ZIP codes as from_polygon (since they were created via polygon import)
  UPDATE worker_service_zipcodes 
  SET from_polygon = true 
  WHERE from_polygon = false AND from_manual = false;
  
  -- Convert polygon coordinates JSON to PostGIS geometry for existing areas
  UPDATE worker_service_areas 
  SET geom = ST_Multi(ST_GeomFromGeoJSON(polygon_coordinates::text))
  WHERE polygon_coordinates IS NOT NULL 
    AND geom IS NULL 
    AND jsonb_typeof(polygon_coordinates) = 'object';
  
  -- Log backfill completion
  INSERT INTO sms_logs (booking_id, recipient_number, message, status, error_message)
  VALUES (NULL, 'system', 'Worker service data backfill completed', 'sent', NULL);
END;
$$;

CREATE OR REPLACE FUNCTION public.assign_zipcode_to_connor(p_zipcode text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  connor_id uuid;
  connor_area_id uuid;
  result jsonb;
BEGIN
  -- Find Connor's user ID
  SELECT id INTO connor_id 
  FROM users 
  WHERE name ILIKE '%connor%' 
    AND role = 'worker'::user_role 
    AND is_active = true
  LIMIT 1;
  
  IF connor_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Connor not found');
  END IF;
  
  -- Find Connor's North Austin area
  SELECT id INTO connor_area_id
  FROM worker_service_areas 
  WHERE worker_id = connor_id 
    AND area_name ILIKE '%north austin%'
    AND is_active = true
  LIMIT 1;
  
  -- Add the ZIP code manually
  PERFORM upsert_manual_zip_coverage(connor_id, p_zipcode, true);
  
  -- Get updated count
  SELECT jsonb_build_object(
    'success', true,
    'worker_id', connor_id,
    'area_id', connor_area_id,
    'zipcode', p_zipcode,
    'total_zipcodes', COUNT(*)
  ) INTO result
  FROM worker_service_zipcodes
  WHERE worker_id = connor_id;
  
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_manual_zip_coverage(p_worker_id uuid, p_zipcode text, p_add boolean DEFAULT true)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
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