-- Clean up debug functions that are no longer needed
DROP FUNCTION IF EXISTS public.debug_guest_booking_policy(uuid, jsonb);
DROP FUNCTION IF EXISTS public.debug_guest_booking_insertion(uuid, jsonb);
DROP FUNCTION IF EXISTS public.test_guest_booking_insertion();