-- Check existing triggers first, then create missing ones safely

-- First, let's see what triggers exist
SELECT trigger_name, event_object_table 
FROM information_schema.triggers 
WHERE trigger_schema = 'public' 
  AND trigger_name NOT LIKE 'RI_%'
ORDER BY event_object_table, trigger_name;

-- Create triggers with IF NOT EXISTS checks
DO $$ 
BEGIN
  -- 1. Auto-assignment trigger for bookings
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers 
    WHERE trigger_name = 'trigger_auto_assign_authorized_booking' 
    AND event_object_table = 'bookings'
  ) THEN
    CREATE TRIGGER trigger_auto_assign_authorized_booking
      AFTER INSERT OR UPDATE ON bookings
      FOR EACH ROW
      EXECUTE FUNCTION trigger_auto_assign_on_authorized_booking();
  END IF;

  -- 2. Worker assignment notification
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers 
    WHERE trigger_name = 'trigger_worker_assignment_email' 
    AND event_object_table = 'bookings'
  ) THEN
    CREATE TRIGGER trigger_worker_assignment_email
      AFTER UPDATE ON bookings
      FOR EACH ROW
      EXECUTE FUNCTION send_worker_assignment_notification();
  END IF;

  -- 3. Customer confirmation email
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers 
    WHERE trigger_name = 'trigger_customer_confirmation_email' 
    AND event_object_table = 'bookings'
  ) THEN
    CREATE TRIGGER trigger_customer_confirmation_email
      AFTER UPDATE ON bookings
      FOR EACH ROW
      EXECUTE FUNCTION send_customer_booking_confirmation();
  END IF;

  -- 4. Booking payment validation
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers 
    WHERE trigger_name = 'trigger_validate_booking_payment_consistency' 
    AND event_object_table = 'bookings'
  ) THEN
    CREATE TRIGGER trigger_validate_booking_payment_consistency
      BEFORE INSERT OR UPDATE ON bookings
      FOR EACH ROW
      EXECUTE FUNCTION validate_booking_payment_consistency();
  END IF;

  -- 5. Payment authorization validation
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers 
    WHERE trigger_name = 'trigger_validate_payment_authorization' 
    AND event_object_table = 'bookings'
  ) THEN
    CREATE TRIGGER trigger_validate_payment_authorization
      BEFORE INSERT OR UPDATE ON bookings
      FOR EACH ROW
      EXECUTE FUNCTION validate_payment_authorization();
  END IF;

  -- 6. Cancellation deadline
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers 
    WHERE trigger_name = 'trigger_set_cancellation_deadline' 
    AND event_object_table = 'bookings'
  ) THEN
    CREATE TRIGGER trigger_set_cancellation_deadline
      BEFORE INSERT OR UPDATE ON bookings
      FOR EACH ROW
      EXECUTE FUNCTION set_cancellation_deadline();
  END IF;

  -- 7. Updated_at timestamps for various tables
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers 
    WHERE trigger_name = 'trigger_update_bookings_updated_at' 
    AND event_object_table = 'bookings'
  ) THEN
    CREATE TRIGGER trigger_update_bookings_updated_at
      BEFORE UPDATE ON bookings
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;

  -- 8. Worker applications updated_at
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers 
    WHERE trigger_name = 'trigger_update_worker_applications_updated_at' 
    AND event_object_table = 'worker_applications'
  ) THEN
    CREATE TRIGGER trigger_update_worker_applications_updated_at
      BEFORE UPDATE ON worker_applications
      FOR EACH ROW
      EXECUTE FUNCTION update_worker_applications_updated_at();
  END IF;

  -- 9. Admin notification on assignment failure
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers 
    WHERE trigger_name = 'trigger_notify_admin_assignment_failure' 
    AND event_object_table = 'bookings'
  ) THEN
    CREATE TRIGGER trigger_notify_admin_assignment_failure
      AFTER UPDATE ON bookings
      FOR EACH ROW
      EXECUTE FUNCTION notify_admin_of_assignment_failure();
  END IF;

  -- 10. Auto-invoicing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers 
    WHERE trigger_name = 'trigger_auto_invoice_on_booking_change' 
    AND event_object_table = 'bookings'
  ) THEN
    CREATE TRIGGER trigger_auto_invoice_on_booking_change
      AFTER INSERT OR UPDATE ON bookings
      FOR EACH ROW
      EXECUTE FUNCTION trigger_auto_invoice();
  END IF;

END $$;