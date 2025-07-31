-- Clean up duplicate triggers on bookings table to avoid conflicts

-- Remove duplicate auto assignment triggers
DROP TRIGGER IF EXISTS trigger_auto_assign_authorized_booking ON public.bookings;

-- Remove duplicate notification triggers  
DROP TRIGGER IF EXISTS trigger_notify_admin_assignment_failure ON public.bookings;

-- Remove duplicate cancellation deadline triggers
DROP TRIGGER IF EXISTS set_booking_cancellation_deadline ON public.bookings;
DROP TRIGGER IF EXISTS set_cancellation_deadline_trigger ON public.bookings;
DROP TRIGGER IF EXISTS trigger_set_cancellation_deadline ON public.bookings;

-- Remove duplicate validation triggers
DROP TRIGGER IF EXISTS trigger_validate_booking_payment_consistency ON public.bookings;
DROP TRIGGER IF EXISTS validate_booking_payment_consistency_trigger ON public.bookings;
DROP TRIGGER IF EXISTS trigger_validate_payment_authorization ON public.bookings;
DROP TRIGGER IF EXISTS validate_booking_payment_authorization ON public.bookings;

-- Remove duplicate worker assignment notification triggers
DROP TRIGGER IF EXISTS trigger_send_worker_assignment ON public.bookings;
DROP TRIGGER IF EXISTS trigger_send_worker_assignment_notification ON public.bookings;
DROP TRIGGER IF EXISTS trigger_worker_assignment_email ON public.bookings;

-- Remove duplicate customer confirmation triggers
DROP TRIGGER IF EXISTS trigger_customer_confirmation_email ON public.bookings;
DROP TRIGGER IF EXISTS trigger_send_customer_booking_confirmation ON public.bookings;
DROP TRIGGER IF EXISTS trigger_send_customer_confirmation ON public.bookings;

-- Remove duplicate invoice triggers
DROP TRIGGER IF EXISTS trigger_auto_invoice ON public.bookings;
DROP TRIGGER IF EXISTS trigger_auto_invoice_on_booking_change ON public.bookings;

-- Remove duplicate updated_at triggers
DROP TRIGGER IF EXISTS trigger_update_bookings_updated_at ON public.bookings;
DROP TRIGGER IF EXISTS update_bookings_updated_at ON public.bookings;

-- Keep only the essential triggers with clear names:

-- 1. Cancellation deadline setting
CREATE OR REPLACE TRIGGER booking_set_cancellation_deadline
    BEFORE INSERT OR UPDATE ON public.bookings
    FOR EACH ROW
    EXECUTE FUNCTION public.set_cancellation_deadline();

-- 2. Payment validation
CREATE OR REPLACE TRIGGER booking_validate_payment_consistency
    BEFORE INSERT OR UPDATE ON public.bookings
    FOR EACH ROW
    EXECUTE FUNCTION public.validate_booking_payment_consistency();

-- 3. Payment authorization validation
CREATE OR REPLACE TRIGGER booking_validate_payment_authorization
    BEFORE INSERT OR UPDATE ON public.bookings
    FOR EACH ROW
    EXECUTE FUNCTION public.validate_payment_authorization();

-- 4. Auto assignment when booking becomes confirmed
CREATE OR REPLACE TRIGGER booking_auto_assign_worker
    AFTER INSERT OR UPDATE ON public.bookings
    FOR EACH ROW
    WHEN (NEW.status = 'confirmed' AND NEW.worker_id IS NULL)
    EXECUTE FUNCTION public.trigger_auto_assign_on_authorized_booking();

-- 5. Worker notification when assigned
CREATE OR REPLACE TRIGGER booking_notify_worker_assignment
    AFTER UPDATE ON public.bookings
    FOR EACH ROW
    WHEN (OLD.worker_id IS NULL AND NEW.worker_id IS NOT NULL)
    EXECUTE FUNCTION public.notify_worker_assignment();

-- 6. Customer confirmation when worker assigned
CREATE OR REPLACE TRIGGER booking_send_customer_confirmation
    AFTER UPDATE ON public.bookings
    FOR EACH ROW
    WHEN (OLD.status != 'confirmed' AND NEW.status = 'confirmed')
    EXECUTE FUNCTION public.send_customer_booking_confirmation();

-- 7. Auto invoice generation
CREATE OR REPLACE TRIGGER booking_auto_invoice
    AFTER UPDATE ON public.bookings
    FOR EACH ROW
    WHEN (NEW.status = 'completed')
    EXECUTE FUNCTION public.trigger_auto_invoice();

-- 8. Update timestamps
CREATE OR REPLACE TRIGGER booking_update_timestamp
    BEFORE UPDATE ON public.bookings
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- 9. Admin notification for failed assignments
CREATE OR REPLACE TRIGGER booking_notify_admin_failure
    AFTER UPDATE ON public.bookings
    FOR EACH ROW
    WHEN (OLD.status != NEW.status AND NEW.status = 'pending' AND NEW.worker_id IS NULL)
    EXECUTE FUNCTION public.notify_admin_of_assignment_failure();