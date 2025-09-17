-- ZCTA-Only Complete Implementation with Full Booking Compatibility
-- This migration implements ZCTA-only approach while maintaining all existing functionality

-- =====================================================
-- PART 1: ZCTA Data Structure and Validation
-- =====================================================

-- Ensure PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- Create ZCTA validation and lookup functions
CREATE OR REPLACE FUNCTION public.validate_zcta_code(p_zcta_code text)
RETURNS TABLE(
  is_valid boolean,
  zcta_code text,
  has_boundary_data boolean,
  can_use_for_service boolean,
  city text,
  state text,
  state_abbr text,
  total_area_sq_miles numeric,
  centroid_lat numeric,
  centroid_lng numeric,
  data_source text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  clean_code text;
BEGIN
  -- Clean ZCTA code (5 digits only)
  clean_code := LEFT(REGEXP_REPLACE(p_zcta_code, '[^0-9]', '', 'g'), 5);
  
  -- Validate format
  IF LENGTH(clean_code) != 5 THEN
    RETURN QUERY SELECT 
      false, clean_code, false, false, 
      'Unknown'::text, 'Unknown'::text, 'Unknown'::text, 
      0::numeric, 0::numeric, 0::numeric, 'invalid'::text;
    RETURN;
  END IF;
  
  -- Check ZCTA polygons first (primary source)
  RETURN QUERY
  SELECT 
    true as is_valid,
    clean_code as zcta_code,
    true as has_boundary_data,
    true as can_use_for_service,
    COALESCE(p.city, 'Service Area') as city,
    COALESCE(p.state, 'US') as state,
    COALESCE(p.state_abbr, 'US') as state_abbr,
    ROUND(((z.land_area + COALESCE(z.water_area, 0)) * 3.861e-7)::numeric, 2) as total_area_sq_miles,
    ST_Y(ST_Centroid(z.geom)) as centroid_lat,
    ST_X(ST_Centroid(z.geom)) as centroid_lng,
    'zcta_boundary' as data_source
  FROM us_zcta_polygons z
  LEFT JOIN us_zip_codes p ON z.zcta5ce = p.zipcode
  WHERE z.zcta5ce = clean_code
  LIMIT 1;
  
  -- If no ZCTA boundary, check if we have postal data
  IF NOT FOUND THEN
    RETURN QUERY
    SELECT 
      EXISTS(SELECT 1 FROM us_zip_codes WHERE zipcode = clean_code) as is_valid,
      clean_code as zcta_code,
      false as has_boundary_data,
      true as can_use_for_service,
      COALESCE(p.city, 'Unknown') as city,
      COALESCE(p.state, 'Unknown') as state,
      COALESCE(p.state_abbr, 'Unknown') as state_abbr,
      0::numeric as total_area_sq_miles,
      COALESCE(p.latitude, 0) as centroid_lat,
      COALESCE(p.longitude, 0) as centroid_lng,
      CASE WHEN p.zipcode IS NOT NULL THEN 'postal_only' ELSE 'not_found' END as data_source
    FROM us_zip_codes p
    WHERE p.zipcode = clean_code;
  END IF;
  
  -- If neither found, return invalid
  IF NOT FOUND THEN
    RETURN QUERY SELECT 
      false, clean_code, false, false, 
      'Unknown'::text, 'Unknown'::text, 'Unknown'::text, 
      0::numeric, 0::numeric, 0::numeric, 'not_found'::text;
  END IF;
END;
$$;

-- =====================================================
-- PART 2: Worker Assignment Functions with Area Names
-- =====================================================

-- Function to assign worker to ZCTA codes with area name
CREATE OR REPLACE FUNCTION public.assign_worker_to_zcta_codes(
  p_worker_id uuid,
  p_area_name text,
  p_zcta_codes text[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_area_id uuid;
  zcta_code text;
  clean_code text;
  assigned_count integer := 0;
  invalid_codes text[] := '{}';
  result jsonb;
  validation_result RECORD;
BEGIN
  -- Validate worker exists and is active
  IF NOT EXISTS (
    SELECT 1 FROM users 
    WHERE id = p_worker_id 
    AND role = 'worker' 
    AND is_active = true
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Worker not found or inactive'
    );
  END IF;

  -- Create new service area
  INSERT INTO worker_service_areas (worker_id, area_name, is_active)
  VALUES (p_worker_id, p_area_name, true)
  RETURNING id INTO new_area_id;

  -- Process each ZCTA code
  FOREACH zcta_code IN ARRAY p_zcta_codes
  LOOP
    -- Clean ZCTA code
    clean_code := LEFT(REGEXP_REPLACE(zcta_code, '[^0-9]', '', 'g'), 5);
    
    -- Validate ZCTA code
    SELECT * INTO validation_result 
    FROM validate_zcta_code(clean_code) 
    LIMIT 1;
    
    IF validation_result.is_valid AND validation_result.can_use_for_service THEN
      -- Insert into worker service zipcodes
      INSERT INTO worker_service_zipcodes (worker_id, service_area_id, zipcode)
      VALUES (p_worker_id, new_area_id, clean_code)
      ON CONFLICT (worker_id, zipcode) DO NOTHING;
      
      assigned_count := assigned_count + 1;
    ELSE
      invalid_codes := array_append(invalid_codes, clean_code);
    END IF;
  END LOOP;

  result := jsonb_build_object(
    'success', true,
    'area_id', new_area_id,
    'area_name', p_area_name,
    'worker_id', p_worker_id,
    'assigned_zcta_codes', assigned_count,
    'invalid_codes', invalid_codes,
    'message', 'Worker assigned to ' || assigned_count || ' ZCTA codes in area: ' || p_area_name
  );

  RETURN result;
END;
$$;

-- Function to find available workers with area info (ZCTA-based)
CREATE OR REPLACE FUNCTION public.find_available_workers_with_area_info(
  p_zcta_code text,
  p_date date,
  p_time time,
  p_duration_minutes integer DEFAULT 60
)
RETURNS TABLE(
  worker_id uuid,
  worker_name text,
  worker_email text,
  worker_phone text,
  area_id uuid,
  area_name text,
  zcta_code text,
  distance_priority integer,
  data_source text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  clean_code text;
  target_day text;
  slot_end_time time;
  validation_result RECORD;
BEGIN
  -- Clean and validate ZCTA code
  clean_code := LEFT(REGEXP_REPLACE(p_zcta_code, '[^0-9]', '', 'g'), 5);
  
  -- Validate ZCTA code exists
  SELECT * INTO validation_result 
  FROM validate_zcta_code(clean_code) 
  LIMIT 1;
  
  IF NOT validation_result.is_valid THEN
    -- Return empty result for invalid ZCTA codes
    RETURN;
  END IF;
  
  -- Get day of week and calculate end time
  target_day := TRIM(TO_CHAR(p_date, 'Day'));
  slot_end_time := p_time + (p_duration_minutes || ' minutes')::INTERVAL;
  
  RETURN QUERY
  SELECT DISTINCT
    u.id as worker_id,
    u.name as worker_name,
    u.email as worker_email,
    u.phone as worker_phone,
    wsa.id as area_id,
    wsa.area_name,
    wsz.zipcode as zcta_code,
    1 as distance_priority, -- All workers have same priority for exact ZCTA match
    validation_result.data_source
  FROM worker_service_zipcodes wsz
  INNER JOIN worker_service_areas wsa ON wsz.service_area_id = wsa.id
  INNER JOIN users u ON wsz.worker_id = u.id
  WHERE wsz.zipcode = clean_code
    AND wsa.is_active = true
    AND u.role = 'worker'
    AND u.is_active = true
    -- Check availability for the requested time
    AND EXISTS (
      SELECT 1 FROM worker_availability wa
      WHERE wa.worker_id = u.id
        AND wa.day_of_week::text = target_day
        AND wa.start_time <= p_time
        AND wa.end_time >= slot_end_time
    )
    -- Ensure no conflicting bookings
    AND NOT EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.worker_id = u.id
        AND b.scheduled_date = p_date
        AND b.status NOT IN ('cancelled', 'completed')
        AND (
          (b.scheduled_start <= p_time AND 
           b.scheduled_start + INTERVAL '1 hour' > p_time) OR
          (p_time <= b.scheduled_start AND 
           slot_end_time > b.scheduled_start)
        )
    )
  ORDER BY wsa.created_at DESC;
END;
$$;

-- =====================================================
-- PART 3: Booking Compatibility Functions
-- =====================================================

-- Enhanced auto-assignment with ZCTA validation and area info
CREATE OR REPLACE FUNCTION public.auto_assign_worker_zcta_enhanced(p_booking_id uuid)
RETURNS TABLE(
  assigned_worker_id uuid, 
  assignment_status text, 
  worker_name text, 
  area_name text,
  zcta_code text,
  data_source text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  booking_record RECORD;
  customer_zcta_code TEXT;
  worker_record RECORD;
  assignment_count INTEGER := 0;
  validation_result RECORD;
BEGIN
  -- Get booking and customer details
  SELECT 
    b.*,
    CASE 
      WHEN b.customer_id IS NOT NULL THEN u.zip_code
      ELSE b.guest_customer_info->>'zipcode'
    END as customer_zcta_code
  INTO booking_record
  FROM public.bookings b
  LEFT JOIN public.users u ON b.customer_id = u.id
  WHERE b.id = p_booking_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;
  
  -- Validate and clean ZCTA code
  customer_zcta_code := booking_record.customer_zcta_code;
  IF customer_zcta_code IS NULL OR LENGTH(customer_zcta_code) < 5 THEN
    RAISE EXCEPTION 'Customer ZCTA code not found for booking. Cannot assign workers.';
  END IF;
  
  customer_zcta_code := LEFT(REGEXP_REPLACE(customer_zcta_code, '[^0-9]', '', 'g'), 5);
  
  -- Validate ZCTA code
  SELECT * INTO validation_result 
  FROM validate_zcta_code(customer_zcta_code) 
  LIMIT 1;
  
  IF NOT validation_result.is_valid THEN
    -- Log invalid ZCTA code
    INSERT INTO public.sms_logs (booking_id, recipient_number, message, status, error_message)
    VALUES (p_booking_id, 'admin', 
      'Invalid ZCTA code: ' || customer_zcta_code || ' - requires manual assignment', 
      'failed', 'Invalid ZCTA code');
      
    RETURN QUERY SELECT 
      NULL::uuid, 'invalid_zcta'::TEXT, NULL::text, NULL::text, customer_zcta_code, 'invalid'::text;
    RETURN;
  END IF;
  
  -- Find and assign worker using ZCTA-based lookup
  FOR worker_record IN 
    SELECT * FROM public.find_available_workers_with_area_info(
      customer_zcta_code,
      booking_record.scheduled_date,
      booking_record.scheduled_start,
      60
    )
    LIMIT 1
  LOOP
    -- Assign worker
    UPDATE public.bookings 
    SET worker_id = worker_record.worker_id, 
        status = 'confirmed',
        notes = COALESCE(notes, '') || ' Assigned to ' || worker_record.worker_name || 
                ' (' || worker_record.area_name || ') for ZCTA ' || customer_zcta_code
    WHERE id = p_booking_id;
    
    INSERT INTO public.worker_bookings (booking_id, worker_id, status)
    VALUES (p_booking_id, worker_record.worker_id, 'assigned');
    
    assignment_count := assignment_count + 1;
    
    -- Log assignment with area info
    INSERT INTO public.sms_logs (booking_id, recipient_number, message, status, error_message)
    VALUES (p_booking_id, 'system', 
      'Auto-assigned to ' || worker_record.worker_name || ' (' || worker_record.area_name || 
      ') for ZCTA ' || customer_zcta_code || ' [' || validation_result.data_source || ']', 
      'sent', NULL);
    
    RETURN QUERY SELECT 
      worker_record.worker_id, 
      'assigned_with_area'::TEXT,
      worker_record.worker_name,
      worker_record.area_name,
      customer_zcta_code,
      validation_result.data_source;
  END LOOP;
  
  -- If no coverage, leave booking as pending with detailed info
  IF assignment_count = 0 THEN
    UPDATE public.bookings 
    SET status = 'pending', 
        notes = COALESCE(notes, '') || ' No worker coverage for ZCTA ' || customer_zcta_code ||
                ' [' || validation_result.city || ', ' || validation_result.state || ']'
    WHERE id = p_booking_id;
    
    -- Log for admin attention with location details
    INSERT INTO public.sms_logs (booking_id, recipient_number, message, status, error_message)
    VALUES (p_booking_id, 'admin', 
      'No worker coverage for ZCTA ' || customer_zcta_code || ' (' || validation_result.city || 
      ', ' || validation_result.state || ') - requires manual assignment', 
      'failed', 'No service area coverage');
    
    RETURN QUERY SELECT 
      NULL::uuid, 
      'no_coverage'::TEXT,
      NULL::text,
      NULL::text,
      customer_zcta_code,
      validation_result.data_source;
  END IF;
  
  RETURN;
END;
$$;

-- Function to get booking assignment details with ZCTA info
CREATE OR REPLACE FUNCTION public.get_booking_assignment_details_zcta(p_booking_id uuid)
RETURNS TABLE(
  booking_id uuid,
  customer_name text,
  customer_zcta_code text,
  customer_city text,
  customer_state text,
  worker_id uuid,
  worker_name text,
  worker_email text,
  worker_phone text,
  area_id uuid,
  area_name text,
  assignment_status text,
  scheduled_date date,
  scheduled_start time,
  zcta_validation jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  validation_result RECORD;
  customer_zcta text;
BEGIN
  -- Get customer ZCTA code first
  SELECT COALESCE(u.zip_code, b.guest_customer_info->>'zipcode') 
  INTO customer_zcta
  FROM bookings b
  LEFT JOIN users u ON b.customer_id = u.id
  WHERE b.id = p_booking_id;
  
  -- Validate ZCTA if found
  IF customer_zcta IS NOT NULL THEN
    SELECT * INTO validation_result 
    FROM validate_zcta_code(customer_zcta) 
    LIMIT 1;
  END IF;
  
  RETURN QUERY
  SELECT 
    b.id as booking_id,
    COALESCE(u.name, b.guest_customer_info->>'name', 'Unknown') as customer_name,
    COALESCE(u.zip_code, b.guest_customer_info->>'zipcode', 'Unknown') as customer_zcta_code,
    COALESCE(validation_result.city, 'Unknown') as customer_city,
    COALESCE(validation_result.state, 'Unknown') as customer_state,
    b.worker_id,
    w.name as worker_name,
    w.email as worker_email,
    w.phone as worker_phone,
    wsa.id as area_id,
    wsa.area_name,
    CASE 
      WHEN b.worker_id IS NOT NULL THEN 'assigned'
      WHEN b.status = 'pending' THEN 'pending'
      ELSE 'unassigned'
    END as assignment_status,
    b.scheduled_date,
    b.scheduled_start,
    CASE 
      WHEN validation_result IS NOT NULL THEN
        jsonb_build_object(
          'is_valid', validation_result.is_valid,
          'has_boundary_data', validation_result.has_boundary_data,
          'data_source', validation_result.data_source,
          'total_area_sq_miles', validation_result.total_area_sq_miles
        )
      ELSE NULL
    END as zcta_validation
  FROM bookings b
  LEFT JOIN users u ON b.customer_id = u.id
  LEFT JOIN users w ON b.worker_id = w.id
  LEFT JOIN worker_service_zipcodes wsz ON w.id = wsz.worker_id 
    AND wsz.zipcode = LEFT(REGEXP_REPLACE(COALESCE(u.zip_code, b.guest_customer_info->>'zipcode', ''), '[^0-9]', '', 'g'), 5)
  LEFT JOIN worker_service_areas wsa ON wsz.service_area_id = wsa.id
  WHERE b.id = p_booking_id;
END;
$$;

-- =====================================================
-- PART 4: Backward Compatibility Functions
-- =====================================================

-- Keep existing find_available_workers_by_zip but route to ZCTA functions
CREATE OR REPLACE FUNCTION public.find_available_workers_by_zip(
  p_zipcode text,
  p_date date,
  p_time time,
  p_duration_minutes integer DEFAULT 60
)
RETURNS TABLE(worker_id uuid, distance_miles numeric)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Route ZIP code lookup to ZCTA function for backward compatibility
  RETURN QUERY
  SELECT 
    w.worker_id,
    0::numeric as distance_miles
  FROM public.find_available_workers_with_area_info(
    p_zipcode, p_date, p_time, p_duration_minutes
  ) w;
END;
$$;

-- Enhanced ZIP coverage check using ZCTA
CREATE OR REPLACE FUNCTION public.zip_has_active_coverage_by_zip(p_zipcode text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  clean_code text;
  validation_result RECORD;
BEGIN
  -- Clean ZIP code
  clean_code := LEFT(REGEXP_REPLACE(p_zipcode, '[^0-9]', '', 'g'), 5);
  
  -- Validate ZCTA code
  SELECT * INTO validation_result 
  FROM validate_zcta_code(clean_code) 
  LIMIT 1;
  
  -- Return false if invalid
  IF NOT validation_result.is_valid THEN
    RETURN false;
  END IF;
  
  -- Check if any active workers cover this ZCTA
  RETURN EXISTS (
    SELECT 1 
    FROM worker_service_zipcodes wsz
    INNER JOIN worker_service_areas wsa ON wsz.service_area_id = wsa.id
    INNER JOIN users u ON wsz.worker_id = u.id
    WHERE wsz.zipcode = clean_code 
    AND wsa.is_active = true
    AND u.role = 'worker'
    AND u.is_active = true
  );
END;
$$;

-- Get worker count by ZIP (ZCTA-based)
CREATE OR REPLACE FUNCTION public.get_worker_count_by_zip(p_zipcode text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  clean_code text;
  validation_result RECORD;
BEGIN
  -- Clean ZIP code
  clean_code := LEFT(REGEXP_REPLACE(p_zipcode, '[^0-9]', '', 'g'), 5);
  
  -- Validate ZCTA code
  SELECT * INTO validation_result 
  FROM validate_zcta_code(clean_code) 
  LIMIT 1;
  
  -- Return 0 if invalid
  IF NOT validation_result.is_valid THEN
    RETURN 0;
  END IF;
  
  -- Count active workers covering this ZCTA
  RETURN (
    SELECT COUNT(DISTINCT wsz.worker_id)
    FROM worker_service_zipcodes wsz
    INNER JOIN worker_service_areas wsa ON wsz.service_area_id = wsa.id
    INNER JOIN users u ON wsz.worker_id = u.id
    WHERE wsz.zipcode = clean_code 
    AND wsa.is_active = true
    AND u.role = 'worker'
    AND u.is_active = true
  );
END;
$$;

-- =====================================================
-- PART 5: ZCTA Management Functions
-- =====================================================

-- Get all ZCTA codes for a worker with area names
CREATE OR REPLACE FUNCTION public.get_worker_zcta_codes_with_areas(p_worker_id uuid)
RETURNS TABLE(
  zcta_code text,
  area_id uuid,
  area_name text,
  is_active boolean,
  created_at timestamptz,
  zcta_validation jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    wsz.zipcode as zcta_code,
    wsa.id as area_id,
    wsa.area_name,
    wsa.is_active,
    wsz.created_at,
    (
      SELECT jsonb_build_object(
        'is_valid', v.is_valid,
        'has_boundary_data', v.has_boundary_data,
        'city', v.city,
        'state', v.state,
        'data_source', v.data_source
      )
      FROM validate_zcta_code(wsz.zipcode) v
      LIMIT 1
    ) as zcta_validation
  FROM worker_service_zipcodes wsz
  INNER JOIN worker_service_areas wsa ON wsz.service_area_id = wsa.id
  WHERE wsz.worker_id = p_worker_id
  ORDER BY wsa.area_name, wsz.zipcode;
END;
$$;

-- Get ZCTA coverage statistics
CREATE OR REPLACE FUNCTION public.get_zcta_coverage_stats()
RETURNS TABLE(
  total_zcta_codes bigint,
  covered_zcta_codes bigint,
  total_workers bigint,
  total_areas bigint,
  coverage_percentage numeric,
  top_states jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (SELECT COUNT(*) FROM us_zcta_polygons) as total_zcta_codes,
    (SELECT COUNT(DISTINCT wsz.zipcode) 
     FROM worker_service_zipcodes wsz 
     INNER JOIN worker_service_areas wsa ON wsz.service_area_id = wsa.id 
     WHERE wsa.is_active = true) as covered_zcta_codes,
    (SELECT COUNT(DISTINCT wsz.worker_id) 
     FROM worker_service_zipcodes wsz 
     INNER JOIN worker_service_areas wsa ON wsz.service_area_id = wsa.id 
     WHERE wsa.is_active = true) as total_workers,
    (SELECT COUNT(*) 
     FROM worker_service_areas 
     WHERE is_active = true) as total_areas,
    ROUND(
      (SELECT COUNT(DISTINCT wsz.zipcode) 
       FROM worker_service_zipcodes wsz 
       INNER JOIN worker_service_areas wsa ON wsz.service_area_id = wsa.id 
       WHERE wsa.is_active = true) * 100.0 / 
      NULLIF((SELECT COUNT(*) FROM us_zcta_polygons), 0), 
      2
    ) as coverage_percentage,
    (
      SELECT jsonb_object_agg(v.state, v.count)
      FROM (
        SELECT 
          COALESCE(zv.state, 'Unknown') as state,
          COUNT(*) as count
        FROM worker_service_zipcodes wsz
        INNER JOIN worker_service_areas wsa ON wsz.service_area_id = wsa.id
        LEFT JOIN LATERAL (
          SELECT state FROM validate_zcta_code(wsz.zipcode) LIMIT 1
        ) zv ON true
        WHERE wsa.is_active = true
        GROUP BY COALESCE(zv.state, 'Unknown')
        ORDER BY count DESC
        LIMIT 10
      ) v
    ) as top_states;
END;
$$;

-- =====================================================
-- PART 6: Indexes and Permissions
-- =====================================================

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_worker_service_zipcodes_zipcode_active 
ON worker_service_zipcodes(zipcode) 
WHERE EXISTS (
  SELECT 1 FROM worker_service_areas wsa 
  WHERE wsa.id = worker_service_zipcodes.service_area_id 
  AND wsa.is_active = true
);

CREATE INDEX IF NOT EXISTS idx_us_zcta_polygons_zcta5ce ON us_zcta_polygons(zcta5ce);
CREATE INDEX IF NOT EXISTS idx_us_zip_codes_zipcode ON us_zip_codes(zipcode);

-- Grant permissions
GRANT EXECUTE ON FUNCTION validate_zcta_code TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION assign_worker_to_zcta_codes TO authenticated;
GRANT EXECUTE ON FUNCTION find_available_workers_with_area_info TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION auto_assign_worker_zcta_enhanced TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_booking_assignment_details_zcta TO authenticated;
GRANT EXECUTE ON FUNCTION find_available_workers_by_zip TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION zip_has_active_coverage_by_zip TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION get_worker_count_by_zip TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION get_worker_zcta_codes_with_areas TO authenticated;
GRANT EXECUTE ON FUNCTION get_zcta_coverage_stats TO authenticated;

-- Add helpful comments
COMMENT ON FUNCTION validate_zcta_code IS 'Validate ZCTA code and return comprehensive location data';
COMMENT ON FUNCTION assign_worker_to_zcta_codes IS 'Assign worker to ZCTA codes with area name and validation';
COMMENT ON FUNCTION find_available_workers_with_area_info IS 'Find available workers for ZCTA with area names';
COMMENT ON FUNCTION auto_assign_worker_zcta_enhanced IS 'Auto-assign worker to booking with ZCTA validation and area info';
COMMENT ON FUNCTION get_booking_assignment_details_zcta IS 'Get booking assignment details with ZCTA validation';
COMMENT ON FUNCTION get_worker_zcta_codes_with_areas IS 'Get all ZCTA codes for worker with validation info';
COMMENT ON FUNCTION get_zcta_coverage_stats IS 'Get comprehensive ZCTA coverage statistics';
