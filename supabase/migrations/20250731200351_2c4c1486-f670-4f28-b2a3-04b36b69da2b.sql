-- Check the trigger_auto_assign_on_authorized_booking function
SELECT pg_get_functiondef(oid) 
FROM pg_proc 
WHERE proname = 'trigger_auto_assign_on_authorized_booking';