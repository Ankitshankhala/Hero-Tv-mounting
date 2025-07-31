-- Check if there's a version conflict with find_available_workers function
-- There might be multiple versions of this function
SELECT 
  proname,
  pronargs,
  pg_get_function_arguments(oid) as arguments,
  pg_get_functiondef(oid) as definition
FROM pg_proc 
WHERE proname = 'find_available_workers';