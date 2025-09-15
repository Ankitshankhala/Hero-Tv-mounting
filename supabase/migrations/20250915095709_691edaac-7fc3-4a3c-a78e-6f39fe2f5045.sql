-- Phase 1: Create Missing RPC Functions and Fix Spatial System

-- Create function to check ZIP code coverage by ZIP
CREATE OR REPLACE FUNCTION public.zip_has_active_coverage_by_zip(p_zipcode text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
    -- Check if ZIP code has active worker coverage through service areas
    RETURN EXISTS (
        SELECT 1 
        FROM worker_service_zipcodes wsz
        INNER JOIN worker_service_areas wsa ON wsz.service_area_id = wsa.id
        INNER JOIN users u ON wsa.worker_id = u.id
        WHERE wsz.zipcode = p_zipcode 
        AND wsa.is_active = true
        AND u.is_active = true
        AND u.role = 'worker'
    );
END;
$$;

-- Create function to get worker count by ZIP
CREATE OR REPLACE FUNCTION public.get_worker_count_by_zip(p_zipcode text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    worker_count INTEGER := 0;
BEGIN
    -- Count active workers serving this ZIP code
    SELECT COUNT(DISTINCT wsa.worker_id)
    INTO worker_count
    FROM worker_service_zipcodes wsz
    INNER JOIN worker_service_areas wsa ON wsz.service_area_id = wsa.id
    INNER JOIN users u ON wsa.worker_id = u.id
    WHERE wsz.zipcode = p_zipcode 
    AND wsa.is_active = true
    AND u.is_active = true
    AND u.role = 'worker';
    
    RETURN COALESCE(worker_count, 0);
END;
$$;

-- Create function to load sample ZIP code data
CREATE OR REPLACE FUNCTION public.load_sample_zipcode_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    sample_data jsonb;
    inserted_count integer := 0;
    existing_count integer;
BEGIN
    -- Check existing data
    SELECT COUNT(*) INTO existing_count FROM us_zip_codes;
    
    -- Sample ZIP codes for major metropolitan areas
    sample_data := '[
        {"zipcode": "75201", "city": "Dallas", "state": "Texas", "state_abbr": "TX", "latitude": 32.7767, "longitude": -96.7970},
        {"zipcode": "75202", "city": "Dallas", "state": "Texas", "state_abbr": "TX", "latitude": 32.7831, "longitude": -96.8067},
        {"zipcode": "75203", "city": "Dallas", "state": "Texas", "state_abbr": "TX", "latitude": 32.7669, "longitude": -96.8144},
        {"zipcode": "75204", "city": "Dallas", "state": "Texas", "state_abbr": "TX", "latitude": 32.7668, "longitude": -96.7836},
        {"zipcode": "75205", "city": "Dallas", "state": "Texas", "state_abbr": "TX", "latitude": 32.7668, "longitude": -96.7836},
        {"zipcode": "77001", "city": "Houston", "state": "Texas", "state_abbr": "TX", "latitude": 29.7604, "longitude": -95.3698},
        {"zipcode": "77002", "city": "Houston", "state": "Texas", "state_abbr": "TX", "latitude": 29.7564, "longitude": -95.3698},
        {"zipcode": "77003", "city": "Houston", "state": "Texas", "state_abbr": "TX", "latitude": 29.7399, "longitude": -95.3371},
        {"zipcode": "78701", "city": "Austin", "state": "Texas", "state_abbr": "TX", "latitude": 30.2672, "longitude": -97.7431},
        {"zipcode": "78702", "city": "Austin", "state": "Texas", "state_abbr": "TX", "latitude": 30.2599, "longitude": -97.7294},
        {"zipcode": "90210", "city": "Beverly Hills", "state": "California", "state_abbr": "CA", "latitude": 34.1030, "longitude": -118.4104},
        {"zipcode": "10001", "city": "New York", "state": "New York", "state_abbr": "NY", "latitude": 40.7505, "longitude": -73.9934},
        {"zipcode": "60601", "city": "Chicago", "state": "Illinois", "state_abbr": "IL", "latitude": 41.8819, "longitude": -87.6278},
        {"zipcode": "33101", "city": "Miami", "state": "Florida", "state_abbr": "FL", "latitude": 25.7743, "longitude": -80.1937},
        {"zipcode": "98101", "city": "Seattle", "state": "Washington", "state_abbr": "WA", "latitude": 47.6062, "longitude": -122.3321}
    ]'::jsonb;
    
    -- Insert sample data if table is mostly empty
    IF existing_count < 10 THEN
        INSERT INTO us_zip_codes (zipcode, city, state, state_abbr, latitude, longitude)
        SELECT 
            (item->>'zipcode')::text,
            (item->>'city')::text,
            (item->>'state')::text,
            (item->>'state_abbr')::text,
            (item->>'latitude')::numeric,
            (item->>'longitude')::numeric
        FROM jsonb_array_elements(sample_data) AS item
        ON CONFLICT (zipcode) DO NOTHING;
        
        GET DIAGNOSTICS inserted_count = ROW_COUNT;
    END IF;
    
    RETURN jsonb_build_object(
        'success', true,
        'existing_count', existing_count,
        'inserted_count', inserted_count,
        'total_count', (SELECT COUNT(*) FROM us_zip_codes),
        'message', 'Sample ZIP code data loaded successfully'
    );
END;
$$;

-- Create function to load ZCTA polygons in batches
CREATE OR REPLACE FUNCTION public.load_zcta_polygons_batch(p_polygons jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    polygon_record jsonb;
    inserted_count integer := 0;
    error_count integer := 0;
    total_count integer;
BEGIN
    -- Get total number of polygons to process
    SELECT jsonb_array_length(p_polygons) INTO total_count;
    
    -- Process each polygon
    FOR polygon_record IN SELECT * FROM jsonb_array_elements(p_polygons)
    LOOP
        BEGIN
            INSERT INTO us_zcta_polygons (zcta5ce, geom, land_area, water_area)
            VALUES (
                polygon_record->>'zcta5ce',
                ST_GeomFromGeoJSON(polygon_record->>'geometry'),
                (polygon_record->>'land_area')::numeric,
                (polygon_record->>'water_area')::numeric
            )
            ON CONFLICT (zcta5ce) DO NOTHING;
            
            inserted_count := inserted_count + 1;
            
        EXCEPTION WHEN OTHERS THEN
            error_count := error_count + 1;
            -- Log error but continue processing
            RAISE NOTICE 'Error processing ZCTA %: %', polygon_record->>'zcta5ce', SQLERRM;
        END;
    END LOOP;
    
    RETURN jsonb_build_object(
        'success', true,
        'processed_count', total_count,
        'inserted_count', inserted_count,
        'error_count', error_count,
        'total_zcta_count', (SELECT COUNT(*) FROM us_zcta_polygons)
    );
END;
$$;

-- Create function to check spatial health
CREATE OR REPLACE FUNCTION public.check_spatial_health()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    zip_count integer;
    zcta_count integer;
    service_area_count integer;
    worker_zip_count integer;
    postgis_available boolean := false;
BEGIN
    -- Check PostGIS availability
    BEGIN
        PERFORM PostGIS_Version();
        postgis_available := true;
    EXCEPTION WHEN OTHERS THEN
        postgis_available := false;
    END;
    
    -- Get data counts
    SELECT COUNT(*) INTO zip_count FROM us_zip_codes;
    SELECT COUNT(*) INTO zcta_count FROM us_zcta_polygons;
    SELECT COUNT(*) INTO service_area_count FROM worker_service_areas WHERE is_active = true;
    SELECT COUNT(DISTINCT zipcode) INTO worker_zip_count FROM worker_service_zipcodes;
    
    RETURN jsonb_build_object(
        'postgis_available', postgis_available,
        'zip_codes', jsonb_build_object(
            'count', zip_count,
            'target', 41000,
            'percentage', ROUND((zip_count::numeric / 41000) * 100, 2)
        ),
        'zcta_polygons', jsonb_build_object(
            'count', zcta_count,
            'target', 33000,
            'percentage', ROUND((zcta_count::numeric / 33000) * 100, 2)
        ),
        'service_areas', jsonb_build_object(
            'active_count', service_area_count,
            'covered_zips', worker_zip_count
        ),
        'recommendations', CASE 
            WHEN zip_count < 1000 THEN jsonb_build_array('Load comprehensive ZIP code data')
            WHEN zcta_count < 1000 THEN jsonb_build_array('Load ZCTA polygon boundaries')
            ELSE jsonb_build_array('System spatial data is healthy')
        END
    );
END;
$$;

-- Create function to find ZIP codes intersecting a polygon
CREATE OR REPLACE FUNCTION public.find_zipcodes_intersecting_polygon(p_polygon jsonb)
RETURNS TABLE(zipcode text, city text, state text, distance_km numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    polygon_geom geometry;
    polygon_center geometry;
BEGIN
    -- Convert input polygon to geometry
    polygon_geom := ST_GeomFromGeoJSON(p_polygon::text);
    polygon_center := ST_Centroid(polygon_geom);
    
    -- Find ZIP codes that intersect with ZCTA polygons within the search polygon
    RETURN QUERY
    SELECT DISTINCT
        z.zipcode,
        z.city,
        z.state,
        ROUND(
            ST_Distance(
                ST_Transform(ST_SetSRID(ST_MakePoint(z.longitude, z.latitude), 4326), 3857),
                ST_Transform(polygon_center, 3857)
            ) / 1000, 2
        ) as distance_km
    FROM us_zip_codes z
    LEFT JOIN us_zcta_polygons zcta ON z.zipcode = zcta.zcta5ce
    WHERE (
        -- If ZCTA polygon exists, check intersection
        (zcta.geom IS NOT NULL AND ST_Intersects(zcta.geom, polygon_geom))
        OR
        -- Fallback: check if ZIP code point is within polygon
        (zcta.geom IS NULL AND z.latitude IS NOT NULL AND z.longitude IS NOT NULL 
         AND ST_Within(
             ST_SetSRID(ST_MakePoint(z.longitude, z.latitude), 4326), 
             polygon_geom
         ))
    )
    ORDER BY distance_km
    LIMIT 1000;
END;
$$;

-- Update the original zip_has_active_coverage function to use new structure
CREATE OR REPLACE FUNCTION public.zip_has_active_coverage(p_zipcode text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
    -- Use the new ZIP-based coverage function
    RETURN zip_has_active_coverage_by_zip(p_zipcode);
END;
$$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_us_zip_codes_zipcode ON us_zip_codes(zipcode);
CREATE INDEX IF NOT EXISTS idx_us_zip_codes_coords ON us_zip_codes(latitude, longitude) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_us_zcta_polygons_zcta5ce ON us_zcta_polygons(zcta5ce);
CREATE INDEX IF NOT EXISTS idx_us_zcta_polygons_geom ON us_zcta_polygons USING GIST(geom);
CREATE INDEX IF NOT EXISTS idx_worker_service_zipcodes_zipcode ON worker_service_zipcodes(zipcode);
CREATE INDEX IF NOT EXISTS idx_worker_service_areas_active ON worker_service_areas(is_active, worker_id) WHERE is_active = true;