-- Drop unused database functions that are safe to remove

-- Drop hardcoded function for specific worker
DROP FUNCTION IF EXISTS public.assign_zipcode_to_connor();

-- Drop one-time migration functions that are no longer needed
DROP FUNCTION IF EXISTS public.backfill_worker_availability_from_applications();
DROP FUNCTION IF EXISTS public.backfill_worker_service_data();