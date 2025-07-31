-- Create the critical missing trigger for transaction status updates
-- This is essential for the payment authorization workflow

-- Check if the transaction status update trigger exists
DO $$ 
BEGIN
  -- Create the transaction status update trigger that was missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers 
    WHERE trigger_name = 'trigger_update_booking_on_payment_auth' 
    AND event_object_table = 'transactions'
  ) THEN
    CREATE TRIGGER trigger_update_booking_on_payment_auth
      AFTER INSERT OR UPDATE ON transactions
      FOR EACH ROW
      EXECUTE FUNCTION update_booking_on_payment_auth();
  END IF;

  -- Also create the notification trigger for worker assignment
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers 
    WHERE trigger_name = 'trigger_notify_worker_assignment' 
    AND event_object_table = 'bookings'
  ) THEN
    CREATE TRIGGER trigger_notify_worker_assignment
      AFTER UPDATE ON bookings
      FOR EACH ROW
      EXECUTE FUNCTION notify_worker_assignment();
  END IF;

END $$;

-- Verify all critical triggers are now in place
SELECT 
  'Trigger Status Check' as status,
  trigger_name,
  event_object_table,
  action_timing,
  event_manipulation
FROM information_schema.triggers 
WHERE trigger_schema = 'public' 
  AND trigger_name IN (
    'trigger_update_booking_on_payment_auth',
    'trigger_auto_assign_authorized_booking', 
    'trigger_send_worker_assignment_notification',
    'trigger_send_customer_booking_confirmation',
    'trigger_notify_worker_assignment'
  )
ORDER BY event_object_table, trigger_name;