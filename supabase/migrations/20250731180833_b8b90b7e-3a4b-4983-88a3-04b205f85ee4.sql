-- FINAL MIGRATION: Complete the migration state
-- This ensures all critical components are in place for the payment authorization workflow

-- 1. Verify and create essential triggers
DO $$ 
DECLARE
    trigger_exists BOOLEAN;
BEGIN
    -- Check and create trigger_update_booking_on_payment_auth
    SELECT EXISTS(
        SELECT 1 FROM information_schema.triggers 
        WHERE trigger_name = 'trigger_update_booking_on_payment_auth' 
        AND event_object_table = 'transactions'
    ) INTO trigger_exists;
    
    IF NOT trigger_exists THEN
        EXECUTE 'CREATE TRIGGER trigger_update_booking_on_payment_auth 
                 AFTER INSERT OR UPDATE ON transactions 
                 FOR EACH ROW 
                 EXECUTE FUNCTION update_booking_on_payment_auth()';
        RAISE NOTICE 'Created trigger_update_booking_on_payment_auth';
    END IF;

    -- Check and create auto assignment trigger
    SELECT EXISTS(
        SELECT 1 FROM information_schema.triggers 
        WHERE trigger_name = 'trigger_auto_assign_authorized_booking' 
        AND event_object_table = 'bookings'
    ) INTO trigger_exists;
    
    IF NOT trigger_exists THEN
        EXECUTE 'CREATE TRIGGER trigger_auto_assign_authorized_booking 
                 AFTER INSERT OR UPDATE ON bookings 
                 FOR EACH ROW 
                 EXECUTE FUNCTION trigger_auto_assign_on_authorized_booking()';
        RAISE NOTICE 'Created trigger_auto_assign_authorized_booking';
    END IF;

END $$;

-- 2. Verify critical functions exist
SELECT 
    'Critical Functions Check' as check_type,
    routine_name,
    routine_type
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name IN (
    'update_booking_on_payment_auth',
    'trigger_auto_assign_on_authorized_booking',
    'auto_assign_workers_with_coverage',
    'find_available_workers'
  )
ORDER BY routine_name;

-- 3. Verify enum types are correct
SELECT 
    'Enum Values Check' as check_type,
    t.typname as enum_name,
    e.enumlabel as enum_value
FROM pg_type t 
JOIN pg_enum e ON t.oid = e.enumtypid 
WHERE t.typname IN ('booking_status', 'payment_status', 'user_role')
ORDER BY t.typname, e.enumsortorder;