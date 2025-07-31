-- Search for any functions that might be using incorrect enum values
-- Let's check functions that contain 'authorized' and see what they're doing

SELECT 
  proname as function_name
FROM pg_proc 
WHERE pg_get_functiondef(oid) LIKE '%authorized%';