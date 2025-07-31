-- The auto_assign_worker function is now broken after dropping the old find_available_workers
-- Let's fix it to use the correct function signature OR disable it if it's not needed

-- First, let's see if this trigger is even active
SELECT 
  t.tgname as trigger_name,
  c.relname as table_name,
  t.tgenabled
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
WHERE t.tgname LIKE '%auto_assign_worker%';

-- Check if there are any other functions that might be setting 'authorized' as booking status
-- Let's look for any INSERT or UPDATE statements in database functions that might be the culprit
SELECT 
  proname,
  pg_get_functiondef(oid)
FROM pg_proc 
WHERE pg_get_functiondef(oid) LIKE '%status.*=.*authorized%'
   OR pg_get_functiondef(oid) LIKE '%UPDATE.*status.*authorized%'
   OR pg_get_functiondef(oid) LIKE '%INSERT.*authorized%';