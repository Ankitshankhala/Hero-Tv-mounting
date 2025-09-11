-- Create triggers
DROP TRIGGER IF EXISTS wsa_after_ins_upd ON public.worker_service_areas;
CREATE TRIGGER wsa_after_ins_upd
AFTER INSERT OR UPDATE OF geom, is_active ON public.worker_service_areas
FOR EACH ROW EXECUTE FUNCTION public.trg_wsa_after_ins_upd();

DROP TRIGGER IF EXISTS wsa_after_del ON public.worker_service_areas;
CREATE TRIGGER wsa_after_del
AFTER DELETE ON public.worker_service_areas
FOR EACH ROW EXECUTE FUNCTION public.trg_wsa_after_del();

-- Add function for backfilling data
CREATE OR REPLACE FUNCTION public.backfill_worker_service_data()
RETURNS void
LANGUAGE plpgsql
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

-- Function to add ZIP to Connor specifically for 78758
CREATE OR REPLACE FUNCTION public.assign_zipcode_to_connor(p_zipcode text)
RETURNS jsonb
LANGUAGE plpgsql
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