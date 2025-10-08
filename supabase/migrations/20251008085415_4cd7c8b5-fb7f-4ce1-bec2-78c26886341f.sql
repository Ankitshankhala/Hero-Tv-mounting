-- Phase 1: Critical Database Fixes for Worker Scheduling System (Fixed)

-- Step 1.1: Clean up existing duplicates in worker_availability before adding unique constraint
WITH duplicates AS (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY worker_id, day_of_week 
    ORDER BY created_at DESC
  ) as rn
  FROM worker_availability
)
DELETE FROM worker_availability 
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);

-- Create proper unique index for worker weekly availability
CREATE UNIQUE INDEX IF NOT EXISTS idx_worker_availability_unique 
ON worker_availability(worker_id, day_of_week);

-- Step 1.2: Fix worker_schedule unique constraint to allow multiple time blocks per day
-- Drop overly restrictive unique constraint if it exists
DROP INDEX IF EXISTS idx_worker_schedule_unique;

-- Create proper unique constraint allowing multiple time blocks per day
CREATE UNIQUE INDEX IF NOT EXISTS idx_worker_schedule_time_unique 
ON worker_schedule(worker_id, work_date, start_time, end_time);

-- Add partial index for overlapping time detection
CREATE INDEX IF NOT EXISTS idx_worker_schedule_overlap_check 
ON worker_schedule(worker_id, work_date, start_time, end_time)
WHERE is_available = true;

-- Step 1.3: Add comprehensive validation trigger for worker_schedule
CREATE OR REPLACE FUNCTION validate_worker_schedule()
RETURNS TRIGGER AS $$
BEGIN
  -- Validate time range
  IF NEW.start_time >= NEW.end_time THEN
    RAISE EXCEPTION 'Start time must be before end time';
  END IF;
  
  -- Validate reasonable time range (6 AM - 11 PM)
  IF NEW.start_time < '06:00'::time OR NEW.end_time > '23:00'::time THEN
    RAISE EXCEPTION 'Schedule must be between 6 AM and 11 PM';
  END IF;
  
  -- Check for overlapping schedules on same day
  IF EXISTS (
    SELECT 1 FROM worker_schedule ws
    WHERE ws.worker_id = NEW.worker_id
      AND ws.work_date = NEW.work_date
      AND ws.id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND (
        (NEW.start_time >= ws.start_time AND NEW.start_time < ws.end_time) OR
        (NEW.end_time > ws.start_time AND NEW.end_time <= ws.end_time) OR
        (NEW.start_time <= ws.start_time AND NEW.end_time >= ws.end_time)
      )
  ) THEN
    RAISE EXCEPTION 'Schedule overlaps with existing schedule';
  END IF;
  
  -- Validate worker exists and is active
  IF NOT EXISTS (
    SELECT 1 FROM users u 
    WHERE u.id = NEW.worker_id 
      AND u.role = 'worker' 
      AND u.is_active = true
  ) THEN
    RAISE EXCEPTION 'Worker does not exist or is not active';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_validate_worker_schedule ON worker_schedule;

-- Create new validation trigger
CREATE TRIGGER trigger_validate_worker_schedule
  BEFORE INSERT OR UPDATE ON worker_schedule
  FOR EACH ROW
  EXECUTE FUNCTION validate_worker_schedule();

-- Step 1.4: Clean up day_of_week enum padding
-- Update all worker_availability records to remove padding
UPDATE worker_availability 
SET day_of_week = TRIM(day_of_week::text)::day_of_week;

-- Add trigger to prevent future padding
CREATE OR REPLACE FUNCTION trim_day_of_week()
RETURNS TRIGGER AS $$
BEGIN
  NEW.day_of_week := TRIM(NEW.day_of_week::text)::day_of_week;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_trim_day_of_week ON worker_availability;

-- Create new trimming trigger
CREATE TRIGGER trigger_trim_day_of_week
  BEFORE INSERT OR UPDATE ON worker_availability
  FOR EACH ROW
  EXECUTE FUNCTION trim_day_of_week();

-- Add regular index for performance (without TRIM function)
CREATE INDEX IF NOT EXISTS idx_worker_availability_lookup 
ON worker_availability(worker_id, day_of_week);