-- Fix for booking failures: Add safe casting from numeric to day_of_week enum
-- This resolves the "cannot cast type numeric to day_of_week" error

-- Create helper function to safely cast numeric day (0-6) to day_of_week enum
CREATE OR REPLACE FUNCTION numeric_to_day_of_week(day_num numeric)
RETURNS day_of_week
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  -- PostgreSQL EXTRACT(DOW...) returns 0=Sunday, 1=Monday, etc.
  CASE day_num::integer
    WHEN 0 THEN RETURN 'sunday'::day_of_week;
    WHEN 1 THEN RETURN 'monday'::day_of_week;
    WHEN 2 THEN RETURN 'tuesday'::day_of_week;
    WHEN 3 THEN RETURN 'wednesday'::day_of_week;
    WHEN 4 THEN RETURN 'thursday'::day_of_week;
    WHEN 5 THEN RETURN 'friday'::day_of_week;
    WHEN 6 THEN RETURN 'saturday'::day_of_week;
    ELSE RAISE EXCEPTION 'Invalid day number: %, must be 0-6', day_num;
  END CASE;
END;
$$;

-- Create explicit cast from numeric to day_of_week
CREATE CAST (numeric AS day_of_week) WITH FUNCTION numeric_to_day_of_week(numeric) AS IMPLICIT;

-- Create explicit cast from double precision to day_of_week  
CREATE CAST (double precision AS day_of_week) WITH FUNCTION numeric_to_day_of_week(numeric) AS IMPLICIT;

-- Also handle integer type which might be involved
CREATE OR REPLACE FUNCTION integer_to_day_of_week(day_num integer)
RETURNS day_of_week
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  CASE day_num
    WHEN 0 THEN RETURN 'sunday'::day_of_week;
    WHEN 1 THEN RETURN 'monday'::day_of_week;
    WHEN 2 THEN RETURN 'tuesday'::day_of_week;
    WHEN 3 THEN RETURN 'wednesday'::day_of_week;
    WHEN 4 THEN RETURN 'thursday'::day_of_week;
    WHEN 5 THEN RETURN 'friday'::day_of_week;
    WHEN 6 THEN RETURN 'saturday'::day_of_week;
    ELSE RAISE EXCEPTION 'Invalid day number: %, must be 0-6', day_num;
  END CASE;
END;
$$;

CREATE CAST (integer AS day_of_week) WITH FUNCTION integer_to_day_of_week(integer) AS IMPLICIT;