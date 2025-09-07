-- Fix RPC functions for zip code validation and service area coverage

-- First, create or replace the zip_has_active_coverage function to use worker service areas
CREATE OR REPLACE FUNCTION public.zip_has_active_coverage(p_zipcode text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    -- Check if zipcode exists in worker service zipcodes with active service areas
    RETURN EXISTS (
        SELECT 1 
        FROM worker_service_zipcodes wsz
        INNER JOIN worker_service_areas wsa ON wsz.service_area_id = wsa.id
        INNER JOIN users u ON wsz.worker_id = u.id
        WHERE wsz.zipcode = p_zipcode 
        AND wsa.is_active = true
        AND u.role = 'worker'
        AND u.is_active = true
    );
END;
$function$;

-- Create or replace the get_zipcode_location_data function with fallback
CREATE OR REPLACE FUNCTION public.get_zipcode_location_data(p_zipcode text)
RETURNS TABLE(city text, state text, zipcode text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    -- For now, return a generic response since we don't have location data table
    -- This ensures the function exists and returns expected structure
    RETURN QUERY SELECT 
        'Service Area'::text as city,
        'US'::text as state,
        p_zipcode::text as zipcode;
END;
$function$;

-- Create or replace find_available_workers_by_zip function for strict zip matching
CREATE OR REPLACE FUNCTION public.find_available_workers_by_zip(
    p_zipcode text,
    p_date date,
    p_time time,
    p_duration_minutes integer DEFAULT 60
)
RETURNS TABLE(worker_id uuid, distance_miles numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    target_day text;
    slot_end_time time;
BEGIN
    -- Get day of week for the target date
    target_day := TRIM(TO_CHAR(p_date, 'Day'));
    slot_end_time := p_time + (p_duration_minutes || ' minutes')::INTERVAL;
    
    RETURN QUERY
    SELECT DISTINCT 
        u.id as worker_id,
        0::numeric as distance_miles -- Default distance for ZIP-based matching
    FROM public.users u
    WHERE u.role = 'worker'
        AND u.is_active = true
        -- STRICT ZIP CODE MATCHING: Worker must have this specific ZIP in their service areas
        AND EXISTS (
            SELECT 1 FROM public.worker_service_zipcodes wsz
            INNER JOIN public.worker_service_areas wsa ON wsz.service_area_id = wsa.id
            WHERE wsz.worker_id = u.id
                AND wsz.zipcode = p_zipcode
                AND wsa.is_active = true
        )
        -- Check if worker has weekly availability for this day and time
        AND EXISTS (
            SELECT 1 FROM public.worker_availability wa
            WHERE wa.worker_id = u.id
                AND wa.day_of_week::text = target_day
                AND wa.start_time <= p_time
                AND wa.end_time >= slot_end_time
        )
        -- Check if worker doesn't have conflicting bookings
        AND NOT EXISTS (
            SELECT 1 FROM public.bookings b
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
    ORDER BY distance_miles;
END;
$function$;