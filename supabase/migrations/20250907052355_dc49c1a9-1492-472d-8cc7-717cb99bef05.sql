-- Fix the get_zipcode_location_data function by dropping and recreating it
DROP FUNCTION IF EXISTS public.get_zipcode_location_data(text);

-- Create the function with proper return structure
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