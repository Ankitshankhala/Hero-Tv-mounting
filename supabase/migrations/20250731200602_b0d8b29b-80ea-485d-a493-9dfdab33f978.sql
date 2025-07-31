-- Check the auto_assign_workers_with_coverage function for incorrect enum usage
SELECT pg_get_functiondef(oid) 
FROM pg_proc 
WHERE proname = 'auto_assign_workers_with_coverage';