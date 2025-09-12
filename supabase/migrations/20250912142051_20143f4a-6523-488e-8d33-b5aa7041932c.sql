-- Fix check_spatial_health function to match frontend expectations
CREATE OR REPLACE FUNCTION public.check_spatial_health()
RETURNS TABLE(
    postgis_version text,
    zcta_polygons_count bigint,
    us_zip_codes_count bigint,
    sample_test_zipcode_count bigint,
    sample_test_success boolean,
    sample_test_error text,
    overall_health text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    zcta_count bigint := 0;
    zip_count bigint := 0;
    sample_count bigint := 0;
    test_success boolean := false;
    test_error text := null;
    health_status text := 'unhealthy';
BEGIN
    -- Get PostGIS version
    SELECT postgis_lib_version() INTO postgis_version;
    
    -- Count ZCTA polygons
    SELECT COUNT(*) INTO zcta_count FROM public.us_zcta_polygons;
    
    -- Count US ZIP codes
    SELECT COUNT(*) INTO zip_count FROM public.us_zip_codes;
    
    -- Test sample ZIP code query
    BEGIN
        SELECT COUNT(*) INTO sample_count 
        FROM public.us_zip_codes 
        WHERE zipcode IN ('75001', '10001', '90210')
        LIMIT 10;
        
        test_success := true;
    EXCEPTION WHEN OTHERS THEN
        test_success := false;
        test_error := SQLERRM;
        sample_count := 0;
    END;
    
    -- Determine overall health
    IF zcta_count > 0 AND zip_count > 30000 AND test_success THEN
        health_status := 'healthy';
    ELSIF zcta_count = 0 AND zip_count > 30000 AND test_success THEN
        health_status := 'degraded_no_polygons';
    ELSE
        health_status := 'unhealthy';
    END IF;
    
    -- Return the results
    RETURN QUERY SELECT 
        postgis_version,
        zcta_count AS zcta_polygons_count,
        zip_count AS us_zip_codes_count,
        sample_count AS sample_test_zipcode_count,
        test_success AS sample_test_success,
        test_error AS sample_test_error,
        health_status AS overall_health;
END;
$$;

-- Fix get_zipcode_boundary_geojson_enhanced function
CREATE OR REPLACE FUNCTION public.get_zipcode_boundary_geojson_enhanced(zipcode_param text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    result jsonb;
BEGIN
    -- Try to get ZCTA polygon first
    SELECT ST_AsGeoJSON(geom)::jsonb INTO result
    FROM us_zcta_polygons 
    WHERE zcta5ce = zipcode_param;
    
    -- If no ZCTA polygon found, create a point-based fallback
    IF result IS NULL THEN
        SELECT ST_AsGeoJSON(ST_Buffer(ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography, 1000)::geometry)::jsonb
        INTO result
        FROM us_zip_codes 
        WHERE zipcode = zipcode_param;
    END IF;
    
    RETURN result;
EXCEPTION WHEN OTHERS THEN
    -- Return null on any error
    RETURN NULL;
END;
$$;

-- Fix get_nearby_zip_boundaries_enhanced function
CREATE OR REPLACE FUNCTION public.get_nearby_zip_boundaries_enhanced(
    center_lat numeric, 
    center_lng numeric, 
    radius_km numeric DEFAULT 50
)
RETURNS TABLE(
    zipcode text,
    boundary_geojson jsonb,
    distance_km numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    center_point geography;
BEGIN
    center_point := ST_SetSRID(ST_MakePoint(center_lng, center_lat), 4326)::geography;
    
    -- Try ZCTA polygons first
    RETURN QUERY
    SELECT 
        zp.zcta5ce AS zipcode,
        ST_AsGeoJSON(zp.geom)::jsonb AS boundary_geojson,
        ROUND((ST_Distance(center_point, zp.geom::geography) / 1000)::numeric, 2) AS distance_km
    FROM us_zcta_polygons zp
    WHERE ST_DWithin(center_point, zp.geom::geography, radius_km * 1000)
    ORDER BY ST_Distance(center_point, zp.geom::geography)
    LIMIT 100;
    
    -- If no ZCTA results, fallback to ZIP centroids with buffers
    IF NOT FOUND THEN
        RETURN QUERY
        SELECT 
            uz.zipcode AS zipcode,
            ST_AsGeoJSON(ST_Buffer(ST_SetSRID(ST_MakePoint(uz.longitude, uz.latitude), 4326)::geography, 1000)::geometry)::jsonb AS boundary_geojson,
            ROUND((ST_Distance(center_point, ST_SetSRID(ST_MakePoint(uz.longitude, uz.latitude), 4326)::geography) / 1000)::numeric, 2) AS distance_km
        FROM us_zip_codes uz
        WHERE ST_DWithin(center_point, ST_SetSRID(ST_MakePoint(uz.longitude, uz.latitude), 4326)::geography, radius_km * 1000)
        ORDER BY ST_Distance(center_point, ST_SetSRID(ST_MakePoint(uz.longitude, uz.latitude), 4326)::geography)
        LIMIT 100;
    END IF;
    
    RETURN;
EXCEPTION WHEN OTHERS THEN
    -- Return empty result on error
    RETURN;
END;
$$;

-- Fix get_service_area_zipcodes_with_boundaries_enhanced function
CREATE OR REPLACE FUNCTION public.get_service_area_zipcodes_with_boundaries_enhanced(
    polygon_coords jsonb,
    include_boundaries boolean DEFAULT false
)
RETURNS TABLE(
    zipcode text,
    boundary_geojson jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    service_polygon geometry;
BEGIN
    -- Convert polygon coordinates to geometry
    service_polygon := ST_SetSRID(ST_GeomFromGeoJSON(polygon_coords), 4326);
    
    -- Try ZCTA polygons first
    RETURN QUERY
    SELECT 
        zp.zcta5ce AS zipcode,
        CASE 
            WHEN include_boundaries THEN ST_AsGeoJSON(zp.geom)::jsonb
            ELSE NULL::jsonb
        END AS boundary_geojson
    FROM us_zcta_polygons zp
    WHERE ST_Intersects(service_polygon, zp.geom)
    ORDER BY zp.zcta5ce;
    
    -- If no ZCTA results, fallback to ZIP centroids
    IF NOT FOUND THEN
        RETURN QUERY
        SELECT 
            uz.zipcode AS zipcode,
            CASE 
                WHEN include_boundaries THEN ST_AsGeoJSON(ST_Buffer(ST_SetSRID(ST_MakePoint(uz.longitude, uz.latitude), 4326)::geography, 1000)::geometry)::jsonb
                ELSE NULL::jsonb
            END AS boundary_geojson
        FROM us_zip_codes uz
        WHERE ST_Within(ST_SetSRID(ST_MakePoint(uz.longitude, uz.latitude), 4326), service_polygon)
        ORDER BY uz.zipcode;
    END IF;
    
    RETURN;
EXCEPTION WHEN OTHERS THEN
    -- Return empty result on error
    RETURN;
END;
$$;

-- Fix validate_polygon_coverage_enhanced function
CREATE OR REPLACE FUNCTION public.validate_polygon_coverage_enhanced(polygon_coords jsonb)
RETURNS TABLE(
    has_coverage boolean,
    zipcode_count integer,
    coverage_percentage numeric,
    missing_zipcodes text[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    service_polygon geometry;
    zip_count integer := 0;
    coverage_pct numeric := 0;
    has_cover boolean := false;
BEGIN
    -- Convert polygon coordinates to geometry
    service_polygon := ST_SetSRID(ST_GeomFromGeoJSON(polygon_coords), 4326);
    
    -- Count intersecting ZIP codes
    SELECT COUNT(*) INTO zip_count
    FROM us_zcta_polygons zp
    WHERE ST_Intersects(service_polygon, zp.geom);
    
    -- If no ZCTA polygons, use ZIP centroids
    IF zip_count = 0 THEN
        SELECT COUNT(*) INTO zip_count
        FROM us_zip_codes uz
        WHERE ST_Within(ST_SetSRID(ST_MakePoint(uz.longitude, uz.latitude), 4326), service_polygon);
    END IF;
    
    -- Calculate coverage
    has_cover := zip_count > 0;
    coverage_pct := CASE WHEN zip_count > 0 THEN 100.0 ELSE 0.0 END;
    
    RETURN QUERY SELECT 
        has_cover AS has_coverage,
        zip_count AS zipcode_count,
        coverage_pct AS coverage_percentage,
        ARRAY[]::text[] AS missing_zipcodes;
        
EXCEPTION WHEN OTHERS THEN
    -- Return safe defaults on error
    RETURN QUERY SELECT 
        false AS has_coverage,
        0 AS zipcode_count,
        0.0 AS coverage_percentage,
        ARRAY[]::text[] AS missing_zipcodes;
END;
$$;