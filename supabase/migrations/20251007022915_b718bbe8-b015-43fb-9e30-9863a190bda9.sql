-- =====================================================
-- Layer 2: Database Triggers for Status Synchronization
-- =====================================================

-- 1. Main trigger function: sync booking status when payment becomes authorized
CREATE OR REPLACE FUNCTION public.sync_booking_status_on_payment_authorized()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only proceed if payment_status changed to 'authorized'
  IF NEW.payment_status = 'authorized' AND 
     (OLD.payment_status IS NULL OR OLD.payment_status != 'authorized') THEN
    
    -- Auto-update status to 'confirmed' if currently in pre-confirmed state
    IF NEW.status IN ('pending', 'payment_pending') THEN
      NEW.status = 'confirmed'::booking_status;
      
      -- Log the automatic status change
      INSERT INTO public.booking_audit_log (
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
          'old_status', OLD.status,
          'new_status', 'confirmed',
          'old_payment_status', OLD.payment_status,
          'new_payment_status', 'authorized',
          'reason', 'Payment authorized - auto-confirming booking'
        ),
        NULL -- system trigger
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- 2. Audit logging trigger function
CREATE OR REPLACE FUNCTION public.log_payment_status_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Log any payment_status or status changes
  IF (OLD.payment_status IS DISTINCT FROM NEW.payment_status) OR
     (OLD.status IS DISTINCT FROM NEW.status) THEN
    
    INSERT INTO public.booking_audit_log (
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
        'old_booking_status', OLD.status,
        'new_booking_status', NEW.status,
        'timestamp', now()
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- 3. Validation trigger to prevent invalid status combinations
CREATE OR REPLACE FUNCTION public.validate_booking_payment_consistency()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Prevent confirmed/completed status if payment is not authorized/completed
  IF NEW.status IN ('confirmed', 'completed') AND
     NEW.payment_status NOT IN ('authorized', 'completed', 'captured') AND
     NEW.payment_intent_id IS NOT NULL THEN
    
    RAISE EXCEPTION 'Invalid status transition: Cannot set booking to % with payment_status %', 
      NEW.status, NEW.payment_status
      USING HINT = 'Payment must be authorized or completed before confirming booking';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS trg_sync_booking_status_on_payment ON public.bookings;
DROP TRIGGER IF EXISTS trg_log_payment_status_changes ON public.bookings;
DROP TRIGGER IF EXISTS trg_validate_booking_payment_consistency ON public.bookings;

-- Attach triggers to bookings table
CREATE TRIGGER trg_sync_booking_status_on_payment
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_booking_status_on_payment_authorized();

CREATE TRIGGER trg_log_payment_status_changes
  AFTER UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.log_payment_status_changes();

CREATE TRIGGER trg_validate_booking_payment_consistency
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_booking_payment_consistency();

-- =====================================================
-- Layer 3: Monitoring and Consistency Checking
-- =====================================================

-- 1. Create view for inconsistency detection
CREATE OR REPLACE VIEW public.v_booking_status_inconsistencies AS
SELECT 
  b.id,
  b.status,
  b.payment_status,
  b.payment_intent_id,
  b.created_at,
  b.updated_at,
  CASE 
    WHEN b.payment_status = 'authorized' AND b.status IN ('pending', 'payment_pending') 
      THEN 'STATUS_BEHIND_PAYMENT'
    WHEN b.status IN ('confirmed', 'completed') AND b.payment_status NOT IN ('authorized', 'completed', 'captured') AND b.payment_intent_id IS NOT NULL
      THEN 'STATUS_AHEAD_OF_PAYMENT'
    WHEN b.payment_intent_id IS NOT NULL AND b.payment_status IS NULL
      THEN 'MISSING_PAYMENT_STATUS'
    ELSE 'UNKNOWN'
  END as inconsistency_type,
  CASE
    WHEN b.payment_status = 'authorized' AND b.status IN ('pending', 'payment_pending')
      THEN 'confirmed'
    ELSE b.status::text
  END as recommended_status
FROM public.bookings b
WHERE 
  -- Has payment intent but inconsistent statuses
  (b.payment_status = 'authorized' AND b.status IN ('pending', 'payment_pending'))
  OR (b.status IN ('confirmed', 'completed') AND b.payment_status NOT IN ('authorized', 'completed', 'captured') AND b.payment_intent_id IS NOT NULL)
  OR (b.payment_intent_id IS NOT NULL AND b.payment_status IS NULL);

-- 2. Consistency repair function
CREATE OR REPLACE FUNCTION public.check_and_repair_booking_consistency()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fixed_count INTEGER := 0;
  v_issue_count INTEGER := 0;
  v_booking RECORD;
  v_result jsonb;
BEGIN
  -- Find and fix inconsistencies
  FOR v_booking IN 
    SELECT * FROM public.v_booking_status_inconsistencies
  LOOP
    v_issue_count := v_issue_count + 1;
    
    -- Auto-fix: Update status to confirmed if payment is authorized
    IF v_booking.inconsistency_type = 'STATUS_BEHIND_PAYMENT' THEN
      UPDATE public.bookings
      SET status = 'confirmed'::booking_status
      WHERE id = v_booking.id;
      
      v_fixed_count := v_fixed_count + 1;
      
      -- Log the repair
      INSERT INTO public.sms_logs (booking_id, recipient_number, message, status)
      VALUES (
        v_booking.id,
        'system',
        'Auto-repaired booking status inconsistency: ' || v_booking.inconsistency_type,
        'sent'
      );
    END IF;
  END LOOP;
  
  -- Build result
  v_result := jsonb_build_object(
    'timestamp', now(),
    'issues_found', v_issue_count,
    'issues_fixed', v_fixed_count,
    'status', CASE WHEN v_issue_count = 0 THEN 'healthy' ELSE 'repaired' END
  );
  
  -- Log summary
  INSERT INTO public.sms_logs (booking_id, recipient_number, message, status)
  VALUES (
    NULL,
    'system',
    'Consistency check completed: ' || v_result::text,
    'sent'
  );
  
  RETURN v_result;
END;
$$;

-- 3. Set up pg_cron job for hourly consistency checks
SELECT cron.schedule(
  'booking-consistency-check',
  '0 * * * *', -- Every hour at :00
  $$SELECT public.check_and_repair_booking_consistency();$$
);

COMMENT ON FUNCTION public.sync_booking_status_on_payment_authorized() IS 'BEFORE UPDATE trigger: Auto-syncs booking status to confirmed when payment becomes authorized';
COMMENT ON FUNCTION public.log_payment_status_changes() IS 'AFTER UPDATE trigger: Logs all payment and booking status changes for audit trail';
COMMENT ON FUNCTION public.validate_booking_payment_consistency() IS 'BEFORE UPDATE trigger: Prevents invalid status combinations';
COMMENT ON VIEW public.v_booking_status_inconsistencies IS 'Monitoring view: Shows bookings with payment_status and status mismatches';
COMMENT ON FUNCTION public.check_and_repair_booking_consistency() IS 'Scheduled job: Hourly check and auto-repair of booking/payment status inconsistencies';