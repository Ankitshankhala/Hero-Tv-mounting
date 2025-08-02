-- Remove all failing database email triggers and functions
DROP TRIGGER IF EXISTS trigger_send_worker_assignment_notification ON public.bookings;
DROP TRIGGER IF EXISTS trigger_send_customer_booking_confirmation ON public.bookings;
DROP FUNCTION IF EXISTS public.send_worker_assignment_notification() CASCADE;
DROP FUNCTION IF EXISTS public.send_customer_booking_confirmation() CASCADE;

-- Clean up failed trigger logs from sms_logs table
DELETE FROM public.sms_logs 
WHERE message LIKE '%email notification failed%' 
OR message LIKE '%Worker email notification failed%' 
OR message LIKE '%Customer email notification failed%';

-- Log the trigger removal
INSERT INTO public.sms_logs (booking_id, recipient_number, message, status, error_message)
VALUES (NULL, 'system', 'Database email triggers removed - switching to application-level emails', 'sent', NULL);