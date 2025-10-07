-- Automatic Booking Status Synchronization System
-- This migration creates triggers to automatically update booking_status when payment_status changes

-- 1. Function: Sync booking_status when payment_status becomes 'authorized'
CREATE OR REPLACE FUNCTION sync_booking_status_on_payment_authorized()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- When payment_status changes to 'authorized', update booking_status to 'confirmed'
  IF NEW.payment_status = 'authorized' AND (OLD.payment_status IS NULL OR OLD.payment_status != 'authorized') THEN
    NEW.status = 'confirmed'::booking_status;
    
    -- Log the automatic status change
    INSERT INTO booking_audit_log (
      booking_id,
      operation,
      status,
      payment_intent_id,
      details,
      created_by
    ) VALUES (
      NEW.id,
      'AUTO_STATUS_SYNC',
      'confirmed',
      NEW.payment_intent_id,
      jsonb_build_object(
        'trigger', 'sync_booking_status_on_payment_authorized',
        'old_booking_status', OLD.status::text,
        'new_booking_status', 'confirmed',
        'old_payment_status', OLD.payment_status,
        'new_payment_status', NEW.payment_status,
        'timestamp', now()
      ),
      NULL -- System-triggered, no user
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- 2. Function: Log all payment status changes for audit trail
CREATE OR REPLACE FUNCTION log_payment_status_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Log whenever payment_status changes
  IF NEW.payment_status IS DISTINCT FROM OLD.payment_status THEN
    INSERT INTO booking_audit_log (
      booking_id,
      operation,
      status,
      payment_intent_id,
      details
    ) VALUES (
      NEW.id,
      'PAYMENT_STATUS_CHANGE',
      NEW.status::text,
      NEW.payment_intent_id,
      jsonb_build_object(
        'old_payment_status', OLD.payment_status,
        'new_payment_status', NEW.payment_status,
        'booking_status', NEW.status::text,
        'timestamp', now()
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- 3. Function: Validate booking and payment status consistency
CREATE OR REPLACE FUNCTION validate_booking_payment_consistency()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- If payment_status is 'authorized', booking_status should be 'confirmed' or later
  IF NEW.payment_status = 'authorized' AND NEW.status NOT IN ('confirmed', 'completed', 'payment_authorized') THEN
    RAISE WARNING 'Inconsistent state detected: payment_status=% but booking_status=%', NEW.payment_status, NEW.status;
    
    -- Auto-correct to 'confirmed'
    NEW.status = 'confirmed'::booking_status;
    
    INSERT INTO booking_audit_log (
      booking_id,
      operation,
      status,
      details,
      error_message
    ) VALUES (
      NEW.id,
      'AUTO_CORRECTION',
      'confirmed',
      jsonb_build_object(
        'reason', 'payment_authorized_but_booking_not_confirmed',
        'corrected_from', OLD.status::text,
        'corrected_to', 'confirmed'
      ),
      'Auto-corrected inconsistent booking status'
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- 4. Attach triggers to bookings table (order matters!)
DROP TRIGGER IF EXISTS trg_sync_booking_status_on_payment ON bookings;
CREATE TRIGGER trg_sync_booking_status_on_payment
  BEFORE UPDATE ON bookings
  FOR EACH ROW
  WHEN (NEW.payment_status IS DISTINCT FROM OLD.payment_status)
  EXECUTE FUNCTION sync_booking_status_on_payment_authorized();

DROP TRIGGER IF EXISTS trg_log_payment_status_changes ON bookings;
CREATE TRIGGER trg_log_payment_status_changes
  AFTER UPDATE ON bookings
  FOR EACH ROW
  WHEN (NEW.payment_status IS DISTINCT FROM OLD.payment_status)
  EXECUTE FUNCTION log_payment_status_changes();

DROP TRIGGER IF EXISTS trg_validate_booking_payment_consistency ON bookings;
CREATE TRIGGER trg_validate_booking_payment_consistency
  BEFORE INSERT OR UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION validate_booking_payment_consistency();

-- 5. Create monitoring view for inconsistent bookings
CREATE OR REPLACE VIEW v_booking_payment_status_monitor AS
SELECT 
  b.id,
  b.status as booking_status,
  b.payment_status,
  b.payment_intent_id,
  b.created_at,
  b.updated_at,
  CASE 
    WHEN b.payment_status = 'authorized' AND b.status NOT IN ('confirmed', 'completed', 'payment_authorized') 
      THEN 'INCONSISTENT: Payment authorized but booking not confirmed'
    WHEN b.payment_status = 'completed' AND b.status NOT IN ('confirmed', 'completed')
      THEN 'INCONSISTENT: Payment completed but booking not confirmed/completed'
    ELSE 'CONSISTENT'
  END as consistency_status
FROM bookings b
WHERE b.payment_intent_id IS NOT NULL
ORDER BY b.created_at DESC;

-- 6. Function: Check and repair booking consistency (can be called manually or via cron)
CREATE OR REPLACE FUNCTION check_and_repair_booking_consistency()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  repaired_count INTEGER := 0;
  booking_record RECORD;
  result jsonb;
BEGIN
  -- Find and repair inconsistent bookings
  FOR booking_record IN
    SELECT id, status, payment_status, payment_intent_id
    FROM bookings
    WHERE payment_status = 'authorized' 
      AND status NOT IN ('confirmed', 'completed', 'payment_authorized')
  LOOP
    -- Update to confirmed
    UPDATE bookings
    SET status = 'confirmed'::booking_status
    WHERE id = booking_record.id;
    
    -- Log the repair
    INSERT INTO booking_audit_log (
      booking_id,
      operation,
      status,
      payment_intent_id,
      details
    ) VALUES (
      booking_record.id,
      'CONSISTENCY_REPAIR',
      'confirmed',
      booking_record.payment_intent_id,
      jsonb_build_object(
        'repaired_from', booking_record.status::text,
        'repaired_to', 'confirmed',
        'payment_status', booking_record.payment_status,
        'timestamp', now()
      )
    );
    
    repaired_count := repaired_count + 1;
  END LOOP;
  
  result := jsonb_build_object(
    'repaired_count', repaired_count,
    'checked_at', now(),
    'status', 'completed'
  );
  
  RETURN result;
END;
$$;

-- 7. Schedule hourly consistency check using pg_cron
SELECT cron.schedule(
  'hourly-booking-consistency-check',
  '0 * * * *', -- Every hour at minute 0
  $$SELECT check_and_repair_booking_consistency()$$
);

-- Log migration completion
INSERT INTO booking_audit_log (
  booking_id,
  operation,
  status,
  details
) VALUES (
  NULL,
  'MIGRATION_COMPLETE',
  'system',
  jsonb_build_object(
    'migration', 'automatic_booking_status_sync',
    'timestamp', now(),
    'description', 'Automatic booking status synchronization system activated'
  )
);