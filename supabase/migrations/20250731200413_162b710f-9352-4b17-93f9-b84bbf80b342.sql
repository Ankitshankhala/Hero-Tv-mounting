-- Check the validate_booking_payment_consistency function which might have the issue
SELECT pg_get_functiondef(oid) 
FROM pg_proc 
WHERE proname = 'validate_booking_payment_consistency';