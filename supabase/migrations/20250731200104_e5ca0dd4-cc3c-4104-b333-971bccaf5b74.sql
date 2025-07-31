-- Search for and fix any database functions using invalid 'authorized' enum value
-- Check the update_booking_on_payment_auth function which likely has the issue

-- First, let's see the current function
SELECT pg_get_functiondef(oid) 
FROM pg_proc 
WHERE proname = 'update_booking_on_payment_auth';