-- Check the validate_payment_status function which might have the enum issue
SELECT pg_get_functiondef(oid) 
FROM pg_proc 
WHERE proname = 'validate_payment_status';