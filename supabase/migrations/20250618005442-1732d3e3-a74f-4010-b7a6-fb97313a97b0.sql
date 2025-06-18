
-- Drop all tables in the correct order to handle foreign key dependencies
-- Drop tables that reference other tables first

DROP TABLE IF EXISTS public.notifications CASCADE;
DROP TABLE IF EXISTS public.invoice_modifications CASCADE;
DROP TABLE IF EXISTS public.on_site_charges CASCADE;
DROP TABLE IF EXISTS public.payment_sessions CASCADE;
DROP TABLE IF EXISTS public.reviews CASCADE;
DROP TABLE IF EXISTS public.sms_logs CASCADE;
DROP TABLE IF EXISTS public.transactions CASCADE;
DROP TABLE IF EXISTS public.worker_schedules CASCADE;
DROP TABLE IF EXISTS public.worker_availability CASCADE;
DROP TABLE IF EXISTS public.worker_applications CASCADE;
DROP TABLE IF EXISTS public.bookings CASCADE;
DROP TABLE IF EXISTS public.services CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

-- Drop custom enum types
DROP TYPE IF EXISTS public.user_role CASCADE;
DROP TYPE IF EXISTS public.booking_status CASCADE;
DROP TYPE IF EXISTS public.payment_status CASCADE;
DROP TYPE IF EXISTS public.sms_status CASCADE;

-- Drop any remaining functions that might reference the dropped tables
DROP FUNCTION IF EXISTS public.create_modification_notification() CASCADE;
DROP FUNCTION IF EXISTS public.apply_late_cancellation_fee() CASCADE;
DROP FUNCTION IF EXISTS public.upsert_worker_schedule(uuid, date, time, time, boolean, text) CASCADE;
DROP FUNCTION IF EXISTS public.handle_worker_cancellation(uuid, text) CASCADE;
DROP FUNCTION IF EXISTS public.get_current_user_role() CASCADE;
