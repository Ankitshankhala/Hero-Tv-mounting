-- Create function to check if a zipcode has active coverage in our service areas
CREATE OR REPLACE FUNCTION public.zip_has_active_coverage(p_zipcode text)
RETURNS boolean AS $$
BEGIN
    -- Check if zipcode exists in regions table and has workers assigned
    RETURN EXISTS (
        SELECT 1 
        FROM regions r
        INNER JOIN worker_profiles wp ON wp.region = r.id
        WHERE r.zipcode = p_zipcode 
        AND wp.is_active = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get zipcode location data from our database
CREATE OR REPLACE FUNCTION public.get_zipcode_location_data(p_zipcode text)
RETURNS TABLE(
    zipcode text,
    city text,
    state text,
    region_name text
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        r.zipcode,
        r.name as city,
        'IN' as state, -- Assuming Indiana based on context
        r.name as region_name
    FROM regions r
    WHERE r.zipcode = p_zipcode
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;