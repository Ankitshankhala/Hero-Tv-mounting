-- Update existing bookings that are stuck in payment_authorized status
-- to confirmed status so they can be properly processed

UPDATE bookings 
SET status = 'confirmed'::booking_status
WHERE status = 'payment_authorized' 
AND payment_status = 'authorized'
AND payment_intent_id IS NOT NULL;