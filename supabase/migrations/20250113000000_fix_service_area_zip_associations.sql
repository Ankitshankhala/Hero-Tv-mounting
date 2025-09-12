-- Fix missing service_area_id associations for ZIP codes
-- This migration addresses the issue where ZIP codes have NULL service_area_id
-- causing the UI to show "0 ZIP codes in this area"

-- First, let's identify and fix orphaned ZIP codes
-- Update ZIP codes that have NULL service_area_id to be associated with the worker's primary area

-- Step 1: For workers who have ZIP codes with NULL service_area_id but have service areas,
-- associate those ZIP codes with their most recently created active area
UPDATE worker_service_zipcodes 
SET service_area_id = (
    SELECT wsa.id 
    FROM worker_service_areas wsa 
    WHERE wsa.worker_id = worker_service_zipcodes.worker_id 
    AND wsa.is_active = true
    ORDER BY wsa.created_at DESC 
    LIMIT 1
)
WHERE service_area_id IS NULL 
AND worker_id IN (
    SELECT DISTINCT worker_id 
    FROM worker_service_areas 
    WHERE is_active = true
);

-- Step 2: For ZIP codes that still have NULL service_area_id after the above update,
-- create a default service area for them
DO $$
DECLARE
    worker_record RECORD;
    new_area_id UUID;
    zip_count INTEGER;
BEGIN
    -- Loop through workers who have ZIP codes with NULL service_area_id
    FOR worker_record IN 
        SELECT DISTINCT worker_id 
        FROM worker_service_zipcodes 
        WHERE service_area_id IS NULL
    LOOP
        -- Count how many ZIP codes this worker has without service area
        SELECT COUNT(*) INTO zip_count
        FROM worker_service_zipcodes 
        WHERE worker_id = worker_record.worker_id 
        AND service_area_id IS NULL;
        
        -- Create a new service area for these ZIP codes
        INSERT INTO worker_service_areas (
            worker_id, 
            area_name, 
            polygon_coordinates, 
            is_active, 
            created_at, 
            updated_at
        ) VALUES (
            worker_record.worker_id,
            'ZIP Codes Area (' || zip_count || ' ZIPs)',
            '[]'::jsonb,
            true,
            NOW(),
            NOW()
        ) RETURNING id INTO new_area_id;
        
        -- Associate the orphaned ZIP codes with this new area
        UPDATE worker_service_zipcodes 
        SET service_area_id = new_area_id
        WHERE worker_id = worker_record.worker_id 
        AND service_area_id IS NULL;
        
        RAISE NOTICE 'Created area % for worker % with % ZIP codes', new_area_id, worker_record.worker_id, zip_count;
    END LOOP;
END $$;

-- Step 3: Add a constraint to prevent future NULL service_area_id (optional, but recommended)
-- Note: This is commented out to avoid breaking existing functionality that might rely on NULL values
-- ALTER TABLE worker_service_zipcodes 
--   ALTER COLUMN service_area_id SET NOT NULL;

-- Step 4: Create a function to automatically associate new ZIP codes with appropriate service areas
CREATE OR REPLACE FUNCTION auto_assign_service_area_to_zipcode()
RETURNS TRIGGER AS $$
DECLARE
    target_area_id UUID;
BEGIN
    -- If service_area_id is already set, don't change it
    IF NEW.service_area_id IS NOT NULL THEN
        RETURN NEW;
    END IF;
    
    -- Try to find an appropriate service area for this worker
    SELECT id INTO target_area_id
    FROM worker_service_areas 
    WHERE worker_id = NEW.worker_id 
    AND is_active = true
    ORDER BY created_at DESC 
    LIMIT 1;
    
    -- If we found an area, assign it
    IF target_area_id IS NOT NULL THEN
        NEW.service_area_id := target_area_id;
    ELSE
        -- Create a default area if none exists
        INSERT INTO worker_service_areas (
            worker_id, 
            area_name, 
            polygon_coordinates, 
            is_active
        ) VALUES (
            NEW.worker_id,
            'Default Service Area',
            '[]'::jsonb,
            true
        ) RETURNING id INTO target_area_id;
        
        NEW.service_area_id := target_area_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger (optional - uncomment if you want automatic assignment)
-- DROP TRIGGER IF EXISTS trigger_auto_assign_service_area ON worker_service_zipcodes;
-- CREATE TRIGGER trigger_auto_assign_service_area
--     BEFORE INSERT ON worker_service_zipcodes
--     FOR EACH ROW
--     EXECUTE FUNCTION auto_assign_service_area_to_zipcode();

-- Step 5: Create an index to improve performance of service area lookups
CREATE INDEX IF NOT EXISTS idx_worker_service_zipcodes_area_id 
ON worker_service_zipcodes(service_area_id) 
WHERE service_area_id IS NOT NULL;

-- Step 6: Add helpful functions for debugging and maintenance
CREATE OR REPLACE FUNCTION get_orphaned_zipcode_stats()
RETURNS TABLE(
    worker_id UUID,
    worker_name TEXT,
    orphaned_zip_count BIGINT,
    total_zip_count BIGINT,
    has_service_areas BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        wsz.worker_id,
        u.name as worker_name,
        COUNT(*) FILTER (WHERE wsz.service_area_id IS NULL) as orphaned_zip_count,
        COUNT(*) as total_zip_count,
        EXISTS(SELECT 1 FROM worker_service_areas wsa WHERE wsa.worker_id = wsz.worker_id AND wsa.is_active = true) as has_service_areas
    FROM worker_service_zipcodes wsz
    LEFT JOIN users u ON u.id = wsz.worker_id
    GROUP BY wsz.worker_id, u.name
    HAVING COUNT(*) FILTER (WHERE wsz.service_area_id IS NULL) > 0
    ORDER BY orphaned_zip_count DESC;
END;
$$ LANGUAGE plpgsql;

-- Log the results
DO $$
DECLARE
    stats_record RECORD;
    total_fixed INTEGER := 0;
BEGIN
    -- Check if there are still any orphaned ZIP codes
    FOR stats_record IN SELECT * FROM get_orphaned_zipcode_stats() LOOP
        RAISE NOTICE 'Worker % (%) still has % orphaned ZIP codes out of %', 
            stats_record.worker_name, 
            stats_record.worker_id, 
            stats_record.orphaned_zip_count,
            stats_record.total_zip_count;
        total_fixed := total_fixed + stats_record.orphaned_zip_count;
    END LOOP;
    
    IF total_fixed = 0 THEN
        RAISE NOTICE 'All ZIP codes now have proper service_area_id associations!';
    ELSE
        RAISE NOTICE 'Migration completed, but % ZIP codes still need manual review', total_fixed;
    END IF;
END $$;
