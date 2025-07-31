-- Let me check if there's a database error that could reveal the specific function with the issue
-- First, let's see what errors might be happening in the logs
SELECT * FROM sms_logs 
WHERE error_message LIKE '%authorized%' 
OR message LIKE '%authorized%'
ORDER BY created_at DESC 
LIMIT 10;