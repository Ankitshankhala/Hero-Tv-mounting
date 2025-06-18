
-- Drop all remaining database functions (without referencing non-existent tables)
DROP FUNCTION IF EXISTS public.calculate_booking_total(uuid[], integer[]) CASCADE;
DROP FUNCTION IF EXISTS public.calculate_cancellation_fee(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.find_available_workers(date, time, integer, text) CASCADE;
DROP FUNCTION IF EXISTS public.auto_assign_worker() CASCADE;
DROP FUNCTION IF EXISTS public.track_cancellation_fee() CASCADE;
DROP FUNCTION IF EXISTS public.apply_late_cancellation_fee() CASCADE;
DROP FUNCTION IF EXISTS public.upsert_worker_schedule(uuid, date, time, time, boolean, text) CASCADE;
DROP FUNCTION IF EXISTS public.handle_worker_cancellation(uuid, text) CASCADE;

-- Note: Triggers were already dropped with the tables in CASCADE mode
