-- Fix day_of_week enum casing to use proper capitalized values
DROP TYPE IF EXISTS day_of_week CASCADE;
CREATE TYPE day_of_week AS ENUM ('Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday');

-- Update worker_availability table to use the new enum
ALTER TABLE worker_availability 
DROP COLUMN IF EXISTS day_of_week CASCADE;

ALTER TABLE worker_availability 
ADD COLUMN day_of_week day_of_week NOT NULL DEFAULT 'Sunday';

-- Update any functions that use lowercase day names
DROP FUNCTION IF EXISTS import_application_availability(uuid) CASCADE;
CREATE OR REPLACE FUNCTION import_application_availability(worker_uuid uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    app_record RECORD;
    day_name text;
    availability_record RECORD;
    start_time_val time;
    end_time_val time;
    inserted_count integer := 0;
BEGIN
    -- Get the worker application
    SELECT * INTO app_record 
    FROM worker_applications 
    WHERE id = worker_uuid;
    
    IF NOT FOUND THEN
        RETURN 'Worker application not found';
    END IF;
    
    -- Clear existing availability for this worker
    DELETE FROM worker_availability WHERE worker_id = worker_uuid;
    
    -- Import availability from application
    FOR day_name IN SELECT * FROM jsonb_object_keys(app_record.availability) LOOP
        -- Get availability data for this day
        SELECT 
            (app_record.availability -> day_name ->> 'enabled')::boolean as enabled,
            (app_record.availability -> day_name ->> 'startTime') as start_time_str,
            (app_record.availability -> day_name ->> 'endTime') as end_time_str
        INTO availability_record;
        
        -- Only process if day is enabled
        IF availability_record.enabled THEN
            -- Convert time strings to time values
            start_time_val := availability_record.start_time_str::time;
            end_time_val := availability_record.end_time_str::time;
            
            -- Map day names to enum values (capitalize first letter)
            INSERT INTO worker_availability (worker_id, day_of_week, start_time, end_time)
            VALUES (
                worker_uuid,
                (UPPER(LEFT(day_name, 1)) || LOWER(SUBSTRING(day_name, 2)))::day_of_week,
                start_time_val,
                end_time_val
            );
            
            inserted_count := inserted_count + 1;
        END IF;
    END LOOP;
    
    RETURN format('Imported %s availability slots', inserted_count);
END;
$$;