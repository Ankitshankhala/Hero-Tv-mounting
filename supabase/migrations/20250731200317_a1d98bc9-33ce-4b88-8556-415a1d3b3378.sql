-- Check for any trigger functions that might be confusing booking status with payment status
-- The issue is likely in a function that checks booking status but uses 'authorized' instead of 'payment_authorized'

-- Let's check if there are any custom triggers or functions we haven't seen
SELECT 
  t.tgname as trigger_name,
  p.proname as function_name,
  c.relname as table_name
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
JOIN pg_class c ON t.tgrelid = c.oid
WHERE p.proname LIKE '%auth%' OR p.proname LIKE '%payment%' OR p.proname LIKE '%booking%';