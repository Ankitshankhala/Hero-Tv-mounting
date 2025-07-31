-- Search for any functions that might be using incorrect enum values
-- Let's check all functions that might be referencing booking status incorrectly

SELECT 
  proname as function_name,
  pg_get_functiondef(oid) as function_definition
FROM pg_proc 
WHERE pg_get_functiondef(oid) LIKE '%authorized%'
  AND pg_get_functiondef(oid) LIKE '%booking%';