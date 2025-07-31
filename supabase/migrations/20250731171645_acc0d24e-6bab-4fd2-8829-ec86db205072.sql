-- Clean Database Migration - Phase 2 Revised (Final Fix)
-- This migration clears all booking data and implements clean authorize-first workflow

-- Step 1: Clear all related tables first to avoid foreign key issues
DELETE FROM public.booking_service_modifications;
DELETE FROM public.booking_services;
DELETE FROM public.worker_bookings;
DELETE FROM public.worker_coverage_notifications;
DELETE FROM public.manual_charges;
DELETE FROM public.onsite_charges;
DELETE FROM public.transactions;
DELETE FROM public.invoice_items;
DELETE FROM public.invoices;
DELETE FROM public.reviews;
DELETE FROM public.email_logs WHERE booking_id IS NOT NULL;
DELETE FROM public.sms_logs WHERE booking_id IS NOT NULL;
DELETE FROM public.booking_audit_log;

-- Step 2: Clear all bookings
DELETE FROM public.bookings;

-- Step 3: Drop all triggers that depend on the status column
DROP TRIGGER IF EXISTS bookings_auto_invoice_trigger ON bookings;
DROP TRIGGER IF EXISTS trigger_auto_assign_on_authorized_booking_trigger ON bookings;
DROP TRIGGER IF EXISTS send_customer_booking_confirmation_trigger ON bookings;
DROP TRIGGER IF EXISTS send_worker_assignment_notification_trigger ON bookings;
DROP TRIGGER IF EXISTS notify_worker_assignment_trigger ON bookings;
DROP TRIGGER IF EXISTS notify_admin_of_assignment_failure_trigger ON bookings;
DROP TRIGGER IF EXISTS set_cancellation_deadline_trigger ON bookings;

-- Step 4: Drop policies that depend on the status column
DROP POLICY IF EXISTS "Enable guest booking updates" ON bookings;
DROP POLICY IF EXISTS "Enable guest booking viewing" ON bookings;

-- Step 5: Remove the default to avoid casting issues
ALTER TABLE public.bookings ALTER COLUMN status DROP DEFAULT;

-- Step 6: Clean up and recreate booking_status enum with proper values
ALTER TYPE booking_status RENAME TO booking_status_old;

CREATE TYPE booking_status AS ENUM (
  'pending',
  'payment_pending', 
  'payment_authorized',
  'confirmed',
  'in_progress',
  'completed',
  'cancelled',
  'failed'
);

-- Update bookings table to use new enum
ALTER TABLE public.bookings 
ALTER COLUMN status TYPE booking_status 
USING 'pending'::booking_status;

-- Now set the proper default
ALTER TABLE public.bookings 
ALTER COLUMN status SET DEFAULT 'pending'::booking_status;

DROP TYPE booking_status_old;

-- Step 7: Recreate the policies with the new enum
CREATE POLICY "Enable guest booking updates" ON bookings
FOR UPDATE
USING (
  (customer_id IS NULL AND ((payment_intent_id IS NOT NULL) OR (status = 'payment_pending'::booking_status))) 
  OR (worker_id = auth.uid()) 
  OR ((auth.uid() IS NOT NULL) AND (get_current_user_role() = 'admin'::text))
);

CREATE POLICY "Enable guest booking viewing" ON bookings
FOR SELECT
USING (
  ((customer_id IS NULL) AND (payment_intent_id IS NOT NULL)) 
  OR (worker_id = auth.uid()) 
  OR ((auth.uid() IS NOT NULL) AND (get_current_user_role() = 'admin'::text))
);

-- Step 8: Recreate essential triggers (updated for new workflow)
CREATE TRIGGER set_cancellation_deadline_trigger
  BEFORE INSERT OR UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION set_cancellation_deadline();

CREATE TRIGGER send_customer_booking_confirmation_trigger
  AFTER UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION send_customer_booking_confirmation();

CREATE TRIGGER send_worker_assignment_notification_trigger
  AFTER UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION send_worker_assignment_notification();

CREATE TRIGGER trigger_auto_assign_on_authorized_booking_trigger
  AFTER INSERT OR UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION trigger_auto_assign_on_authorized_booking();

CREATE TRIGGER notify_worker_assignment_trigger
  AFTER UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION notify_worker_assignment();

CREATE TRIGGER notify_admin_of_assignment_failure_trigger
  AFTER UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION notify_admin_of_assignment_failure();

CREATE TRIGGER bookings_auto_invoice_trigger
  AFTER INSERT OR UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION trigger_auto_invoice();

-- Step 9: Create validation function for booking/payment status consistency
CREATE OR REPLACE FUNCTION validate_booking_payment_consistency()
RETURNS TRIGGER AS $$
BEGIN
  -- Ensure booking_status and payment_status are consistent
  CASE NEW.status
    WHEN 'payment_pending' THEN
      IF NEW.payment_status NOT IN ('pending') THEN
        RAISE EXCEPTION 'payment_pending bookings must have pending payment_status, got: %', NEW.payment_status;
      END IF;
    WHEN 'payment_authorized' THEN
      IF NEW.payment_status NOT IN ('authorized') THEN
        RAISE EXCEPTION 'payment_authorized bookings must have authorized payment_status, got: %', NEW.payment_status;
      END IF;
    WHEN 'confirmed' THEN
      IF NEW.payment_status NOT IN ('authorized', 'completed') THEN
        RAISE EXCEPTION 'confirmed bookings must have authorized or completed payment_status, got: %', NEW.payment_status;
      END IF;
    WHEN 'completed' THEN
      IF NEW.payment_status NOT IN ('completed') THEN
        RAISE EXCEPTION 'completed bookings must have completed payment_status, got: %', NEW.payment_status;
      END IF;
    WHEN 'cancelled' THEN
      IF NEW.payment_status NOT IN ('failed', 'cancelled') THEN
        RAISE EXCEPTION 'cancelled bookings must have failed or cancelled payment_status, got: %', NEW.payment_status;
      END IF;
    WHEN 'failed' THEN
      IF NEW.payment_status NOT IN ('failed') THEN
        RAISE EXCEPTION 'failed bookings must have failed payment_status, got: %', NEW.payment_status;
      END IF;
  END CASE;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 10: Create trigger for booking/payment status consistency
CREATE TRIGGER validate_booking_payment_consistency_trigger
  BEFORE INSERT OR UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION validate_booking_payment_consistency();

-- Step 11: Update payment authorization trigger for new workflow
DROP TRIGGER IF EXISTS update_booking_on_payment_auth_trigger ON transactions;

CREATE OR REPLACE FUNCTION update_booking_on_payment_auth()
RETURNS TRIGGER AS $$
BEGIN
  -- When a transaction becomes authorized, update booking to payment_authorized
  IF NEW.status = 'authorized' AND (OLD.status IS NULL OR OLD.status != 'authorized') THEN
    UPDATE bookings 
    SET 
      status = 'payment_authorized'::booking_status,
      payment_status = 'authorized'
    WHERE id = NEW.booking_id;
  END IF;
  
  -- When a transaction is completed (captured), update booking to confirmed
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    UPDATE bookings 
    SET 
      status = 'confirmed'::booking_status,
      payment_status = 'completed'
    WHERE id = NEW.booking_id;
  END IF;
  
  -- When a transaction fails, update booking appropriately
  IF NEW.status = 'failed' AND (OLD.status IS NULL OR OLD.status != 'failed') THEN
    UPDATE bookings 
    SET 
      status = 'failed'::booking_status,
      payment_status = 'failed'
    WHERE id = NEW.booking_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_booking_on_payment_auth_trigger
  AFTER INSERT OR UPDATE ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_booking_on_payment_auth();

-- Step 12: Log successful migration
INSERT INTO public.sms_logs (booking_id, recipient_number, message, status, error_message)
VALUES (NULL, 'system', 'Clean database migration completed successfully - all booking data cleared and authorize-first workflow implemented', 'sent', NULL);