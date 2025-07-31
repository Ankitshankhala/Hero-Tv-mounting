-- Create all missing critical triggers for payment authorization workflow

-- 1. Trigger to update booking status when payment transactions change
CREATE TRIGGER trigger_update_booking_on_payment_auth
    AFTER INSERT OR UPDATE ON public.transactions
    FOR EACH ROW
    EXECUTE FUNCTION public.update_booking_on_payment_auth();

-- 2. Trigger to auto-assign workers when booking becomes authorized
CREATE TRIGGER trigger_auto_assign_authorized_booking
    AFTER INSERT OR UPDATE ON public.bookings
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_auto_assign_on_authorized_booking();

-- 3. Trigger to send customer confirmation emails when booking is confirmed
CREATE TRIGGER trigger_send_customer_confirmation
    AFTER UPDATE ON public.bookings
    FOR EACH ROW
    EXECUTE FUNCTION public.send_customer_booking_confirmation();

-- 4. Trigger to send worker assignment notifications
CREATE TRIGGER trigger_send_worker_assignment
    AFTER UPDATE ON public.bookings
    FOR EACH ROW
    EXECUTE FUNCTION public.send_worker_assignment_notification();

-- 5. Trigger to set cancellation deadline
CREATE TRIGGER trigger_set_cancellation_deadline
    BEFORE INSERT OR UPDATE ON public.bookings
    FOR EACH ROW
    EXECUTE FUNCTION public.set_cancellation_deadline();

-- 6. Trigger to validate booking payment consistency
CREATE TRIGGER trigger_validate_booking_payment_consistency
    BEFORE INSERT OR UPDATE ON public.bookings
    FOR EACH ROW
    EXECUTE FUNCTION public.validate_booking_payment_consistency();

-- 7. Trigger to validate payment status
CREATE TRIGGER trigger_validate_payment_status
    BEFORE INSERT OR UPDATE ON public.transactions
    FOR EACH ROW
    EXECUTE FUNCTION public.validate_payment_status();

-- 8. Trigger to update transaction cancelled_at timestamp
CREATE TRIGGER trigger_update_transaction_cancelled_at
    BEFORE UPDATE ON public.transactions
    FOR EACH ROW
    EXECUTE FUNCTION public.update_transaction_cancelled_at();

-- 9. Trigger to update updated_at columns
CREATE TRIGGER trigger_bookings_updated_at
    BEFORE UPDATE ON public.bookings
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trigger_booking_services_updated_at
    BEFORE UPDATE ON public.booking_services
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- 10. Trigger for auto-invoicing when bookings are completed
CREATE TRIGGER trigger_auto_invoice
    AFTER UPDATE ON public.bookings
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_auto_invoice();

-- Verify all triggers were created successfully
SELECT 
    trigger_name,
    event_object_table,
    action_timing,
    event_manipulation
FROM information_schema.triggers 
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;