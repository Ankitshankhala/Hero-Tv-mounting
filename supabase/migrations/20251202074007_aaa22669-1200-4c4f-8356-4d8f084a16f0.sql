-- Drop and recreate retry_unsent_notifications with correct edge function name
DROP FUNCTION IF EXISTS public.retry_unsent_notifications(integer, integer);

CREATE FUNCTION public.retry_unsent_notifications(
  p_lookback_minutes integer DEFAULT 120,
  p_max_retries integer DEFAULT 5
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking RECORD;
  v_result jsonb := '{"processed": 0, "customer_emails": 0, "worker_emails": 0, "skipped": 0}'::jsonb;
  v_response jsonb;
  v_supabase_url text;
  v_service_key text;
BEGIN
  v_supabase_url := current_setting('app.settings.supabase_url', true);
  v_service_key := current_setting('app.settings.service_role_key', true);
  
  IF v_supabase_url IS NULL THEN
    v_supabase_url := 'https://ggvplltpwsnvtcbpazbe.supabase.co';
  END IF;

  FOR v_booking IN
    SELECT 
      b.id as booking_id,
      b.customer_id,
      b.worker_id,
      b.confirmation_email_sent,
      b.worker_assignment_email_sent,
      b.status,
      b.payment_status
    FROM bookings b
    WHERE b.created_at > NOW() - (p_lookback_minutes || ' minutes')::interval
      AND b.status IN ('confirmed', 'scheduled', 'in_progress')
      AND b.payment_status IN ('authorized', 'captured', 'paid')
      AND (
        b.confirmation_email_sent = false 
        OR (b.worker_id IS NOT NULL AND b.worker_assignment_email_sent = false)
      )
    ORDER BY b.created_at DESC
    LIMIT p_max_retries
  LOOP
    v_result := jsonb_set(v_result, '{processed}', to_jsonb((v_result->>'processed')::int + 1));

    IF v_booking.confirmation_email_sent = false THEN
      IF NOT EXISTS (
        SELECT 1 FROM email_logs 
        WHERE booking_id = v_booking.booking_id 
          AND email_type = 'booking_confirmation' 
          AND status = 'sent'
      ) THEN
        RAISE NOTICE 'Retrying customer confirmation for booking %', v_booking.booking_id;
        
        BEGIN
          SELECT net.http_post(
            url := v_supabase_url || '/functions/v1/send-customer-booking-confirmation-email',
            headers := jsonb_build_object(
              'Content-Type', 'application/json',
              'Authorization', 'Bearer ' || v_service_key
            ),
            body := jsonb_build_object('booking_id', v_booking.booking_id)
          ) INTO v_response;
          
          v_result := jsonb_set(v_result, '{customer_emails}', to_jsonb((v_result->>'customer_emails')::int + 1));
        EXCEPTION WHEN OTHERS THEN
          RAISE WARNING 'Failed to call customer email function for booking %: %', v_booking.booking_id, SQLERRM;
        END;
      ELSE
        UPDATE bookings SET confirmation_email_sent = true WHERE id = v_booking.booking_id;
        v_result := jsonb_set(v_result, '{skipped}', to_jsonb((v_result->>'skipped')::int + 1));
      END IF;
    END IF;

    IF v_booking.worker_id IS NOT NULL AND v_booking.worker_assignment_email_sent = false THEN
      IF NOT EXISTS (
        SELECT 1 FROM email_logs el
        JOIN users w ON el.recipient_email = w.email
        WHERE el.booking_id = v_booking.booking_id 
          AND el.email_type = 'worker_assignment' 
          AND el.status = 'sent'
          AND w.id = v_booking.worker_id
      ) THEN
        RAISE NOTICE 'Retrying worker assignment for booking %, worker %', v_booking.booking_id, v_booking.worker_id;
        
        BEGIN
          SELECT net.http_post(
            url := v_supabase_url || '/functions/v1/send-worker-assignment-notification',
            headers := jsonb_build_object(
              'Content-Type', 'application/json',
              'Authorization', 'Bearer ' || v_service_key
            ),
            body := jsonb_build_object(
              'booking_id', v_booking.booking_id,
              'worker_id', v_booking.worker_id
            )
          ) INTO v_response;
          
          v_result := jsonb_set(v_result, '{worker_emails}', to_jsonb((v_result->>'worker_emails')::int + 1));
        EXCEPTION WHEN OTHERS THEN
          RAISE WARNING 'Failed to call worker email function for booking %: %', v_booking.booking_id, SQLERRM;
        END;
      ELSE
        UPDATE bookings SET worker_assignment_email_sent = true WHERE id = v_booking.booking_id;
        v_result := jsonb_set(v_result, '{skipped}', to_jsonb((v_result->>'skipped')::int + 1));
      END IF;
    END IF;

  END LOOP;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.retry_unsent_notifications IS 
'Fixed to use correct edge function: send-customer-booking-confirmation-email';

-- Fix existing bookings where emails were sent but flags weren't updated
UPDATE bookings b
SET confirmation_email_sent = true
WHERE confirmation_email_sent = false
  AND EXISTS (
    SELECT 1 FROM email_logs el
    WHERE el.booking_id = b.id
      AND el.email_type = 'booking_confirmation'
      AND el.status = 'sent'
  );

UPDATE bookings b
SET worker_assignment_email_sent = true
WHERE worker_assignment_email_sent = false
  AND worker_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM email_logs el
    JOIN users w ON el.recipient_email = w.email AND w.id = b.worker_id
    WHERE el.booking_id = b.id
      AND el.email_type = 'worker_assignment'
      AND el.status = 'sent'
  );
