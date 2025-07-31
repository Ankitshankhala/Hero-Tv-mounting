-- Create only the missing critical triggers for payment authorization workflow
-- This script checks if each trigger exists before creating it

DO $$ 
DECLARE
    trigger_exists BOOLEAN;
BEGIN
    -- 1. Trigger to auto-assign workers when booking becomes authorized
    SELECT EXISTS(
        SELECT 1 FROM information_schema.triggers 
        WHERE trigger_name = 'trigger_auto_assign_authorized_booking' 
        AND event_object_table = 'bookings'
    ) INTO trigger_exists;
    
    IF NOT trigger_exists THEN
        CREATE TRIGGER trigger_auto_assign_authorized_booking
            AFTER INSERT OR UPDATE ON public.bookings
            FOR EACH ROW
            EXECUTE FUNCTION public.trigger_auto_assign_on_authorized_booking();
        RAISE NOTICE 'Created trigger_auto_assign_authorized_booking';
    END IF;

    -- 2. Trigger to send customer confirmation emails when booking is confirmed
    SELECT EXISTS(
        SELECT 1 FROM information_schema.triggers 
        WHERE trigger_name = 'trigger_send_customer_confirmation' 
        AND event_object_table = 'bookings'
    ) INTO trigger_exists;
    
    IF NOT trigger_exists THEN
        CREATE TRIGGER trigger_send_customer_confirmation
            AFTER UPDATE ON public.bookings
            FOR EACH ROW
            EXECUTE FUNCTION public.send_customer_booking_confirmation();
        RAISE NOTICE 'Created trigger_send_customer_confirmation';
    END IF;

    -- 3. Trigger to send worker assignment notifications
    SELECT EXISTS(
        SELECT 1 FROM information_schema.triggers 
        WHERE trigger_name = 'trigger_send_worker_assignment' 
        AND event_object_table = 'bookings'
    ) INTO trigger_exists;
    
    IF NOT trigger_exists THEN
        CREATE TRIGGER trigger_send_worker_assignment
            AFTER UPDATE ON public.bookings
            FOR EACH ROW
            EXECUTE FUNCTION public.send_worker_assignment_notification();
        RAISE NOTICE 'Created trigger_send_worker_assignment';
    END IF;

    -- 4. Trigger to set cancellation deadline
    SELECT EXISTS(
        SELECT 1 FROM information_schema.triggers 
        WHERE trigger_name = 'trigger_set_cancellation_deadline' 
        AND event_object_table = 'bookings'
    ) INTO trigger_exists;
    
    IF NOT trigger_exists THEN
        CREATE TRIGGER trigger_set_cancellation_deadline
            BEFORE INSERT OR UPDATE ON public.bookings
            FOR EACH ROW
            EXECUTE FUNCTION public.set_cancellation_deadline();
        RAISE NOTICE 'Created trigger_set_cancellation_deadline';
    END IF;

    -- 5. Trigger to validate booking payment consistency
    SELECT EXISTS(
        SELECT 1 FROM information_schema.triggers 
        WHERE trigger_name = 'trigger_validate_booking_payment_consistency' 
        AND event_object_table = 'bookings'
    ) INTO trigger_exists;
    
    IF NOT trigger_exists THEN
        CREATE TRIGGER trigger_validate_booking_payment_consistency
            BEFORE INSERT OR UPDATE ON public.bookings
            FOR EACH ROW
            EXECUTE FUNCTION public.validate_booking_payment_consistency();
        RAISE NOTICE 'Created trigger_validate_booking_payment_consistency';
    END IF;

    -- 6. Trigger to validate payment status
    SELECT EXISTS(
        SELECT 1 FROM information_schema.triggers 
        WHERE trigger_name = 'trigger_validate_payment_status' 
        AND event_object_table = 'transactions'
    ) INTO trigger_exists;
    
    IF NOT trigger_exists THEN
        CREATE TRIGGER trigger_validate_payment_status
            BEFORE INSERT OR UPDATE ON public.transactions
            FOR EACH ROW
            EXECUTE FUNCTION public.validate_payment_status();
        RAISE NOTICE 'Created trigger_validate_payment_status';
    END IF;

    -- 7. Trigger to update transaction cancelled_at timestamp
    SELECT EXISTS(
        SELECT 1 FROM information_schema.triggers 
        WHERE trigger_name = 'trigger_update_transaction_cancelled_at' 
        AND event_object_table = 'transactions'
    ) INTO trigger_exists;
    
    IF NOT trigger_exists THEN
        CREATE TRIGGER trigger_update_transaction_cancelled_at
            BEFORE UPDATE ON public.transactions
            FOR EACH ROW
            EXECUTE FUNCTION public.update_transaction_cancelled_at();
        RAISE NOTICE 'Created trigger_update_transaction_cancelled_at';
    END IF;

    -- 8. Trigger for auto-invoicing when bookings are completed
    SELECT EXISTS(
        SELECT 1 FROM information_schema.triggers 
        WHERE trigger_name = 'trigger_auto_invoice' 
        AND event_object_table = 'bookings'
    ) INTO trigger_exists;
    
    IF NOT trigger_exists THEN
        CREATE TRIGGER trigger_auto_invoice
            AFTER UPDATE ON public.bookings
            FOR EACH ROW
            EXECUTE FUNCTION public.trigger_auto_invoice();
        RAISE NOTICE 'Created trigger_auto_invoice';
    END IF;

END $$;

-- Verify all triggers were created successfully
SELECT 
    'Active Triggers' as check_type,
    trigger_name,
    event_object_table,
    action_timing,
    event_manipulation
FROM information_schema.triggers 
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;