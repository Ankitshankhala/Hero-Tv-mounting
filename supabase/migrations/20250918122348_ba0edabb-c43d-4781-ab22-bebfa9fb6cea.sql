-- Fix payment status inconsistency: Update September 2025 bookings from 'completed' to 'captured'
-- This ensures consistency with August bookings which correctly use 'captured' status

UPDATE public.bookings 
SET payment_status = 'captured'
WHERE payment_status = 'completed' 
AND scheduled_date >= '2025-09-01' 
AND scheduled_date < '2025-10-01';

-- Verify the change by checking that no September bookings have 'completed' payment status
-- This query should return 0 rows after the update
SELECT COUNT(*) as remaining_completed_count
FROM public.bookings 
WHERE payment_status = 'completed' 
AND scheduled_date >= '2025-09-01' 
AND scheduled_date < '2025-10-01';

-- Log the correction for audit purposes
INSERT INTO public.sms_logs (booking_id, recipient_number, message, status, error_message)
VALUES (NULL, 'system', 'Payment status corrected: September bookings updated from completed to captured for consistency', 'sent', NULL);