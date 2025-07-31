-- Check if there are any functions that incorrectly set booking status to 'authorized'
-- Let's examine the actual issue from the recent booking that failed

-- First, let's see what's happening with the problematic booking
SELECT 
  id, 
  status, 
  payment_status, 
  payment_intent_id,
  created_at
FROM bookings 
WHERE id = 'ca8fdece-64de-42f0-aa82-29f7d50a39f1';