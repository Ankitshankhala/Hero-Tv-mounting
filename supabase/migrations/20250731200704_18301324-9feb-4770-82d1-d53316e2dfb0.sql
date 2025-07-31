-- Fix the conflicting find_available_workers function
-- Drop the old version and keep only the correct one
DROP FUNCTION IF EXISTS public.find_available_workers(job_date date, job_time time without time zone, job_duration integer, job_region text);

-- Also, let's see if there's an auto_assign_worker function (singular) that might be the issue
SELECT pg_get_functiondef(oid) 
FROM pg_proc 
WHERE proname = 'auto_assign_worker';