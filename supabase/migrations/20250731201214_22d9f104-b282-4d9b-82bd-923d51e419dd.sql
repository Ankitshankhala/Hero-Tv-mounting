-- Fix workflow: Update edge function to look for 'confirmed' status and remove duplicate triggers

-- First, let's check current triggers on bookings table
SELECT 
    trigger_name,
    event_manipulation,
    action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'bookings' 
AND trigger_schema = 'public'
ORDER BY trigger_name;

-- Remove the duplicate auto_assign_worker trigger if it exists
-- This function is not properly connected and conflicts with the main workflow
DROP TRIGGER IF EXISTS auto_assign_worker_trigger ON public.bookings;

-- Ensure we have clean, single-path workflow:
-- 1. Transaction becomes 'authorized' 
-- 2. update_booking_on_payment_auth trigger updates booking to 'confirmed'
-- 3. trigger_auto_assign_on_authorized_booking calls auto_assign_workers_with_coverage
-- 4. If assignment fails, admin gets notified

-- Update the booking trigger to be more specific and avoid conflicts
DROP TRIGGER IF EXISTS trigger_auto_assign_on_authorized_booking ON public.bookings;

CREATE OR REPLACE TRIGGER trigger_auto_assign_on_authorized_booking
    AFTER INSERT OR UPDATE ON public.bookings
    FOR EACH ROW
    WHEN (NEW.status = 'confirmed' AND NEW.worker_id IS NULL)
    EXECUTE FUNCTION public.trigger_auto_assign_on_authorized_booking();

-- Also ensure we have proper admin notification for failed assignments
CREATE OR REPLACE TRIGGER notify_admin_assignment_failure
    AFTER UPDATE ON public.bookings
    FOR EACH ROW
    WHEN (OLD.status != NEW.status AND NEW.status = 'pending' AND NEW.worker_id IS NULL)
    EXECUTE FUNCTION public.notify_admin_of_assignment_failure();