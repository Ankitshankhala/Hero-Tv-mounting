-- Add worker acknowledgment tracking columns
ALTER TABLE worker_bookings 
ADD COLUMN ack_status text DEFAULT 'pending' CHECK (ack_status IN ('pending', 'acknowledged', 'expired')),
ADD COLUMN ack_deadline timestamp with time zone DEFAULT (now() + interval '10 minutes'),
ADD COLUMN ack_at timestamp with time zone;

-- Create worker acknowledgment function
CREATE OR REPLACE FUNCTION public.acknowledge_assignment(p_booking_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  worker_booking_record RECORD;
BEGIN
  -- Update worker booking acknowledgment
  UPDATE worker_bookings 
  SET ack_status = 'acknowledged', 
      ack_at = now()
  WHERE booking_id = p_booking_id 
    AND worker_id = auth.uid()
    AND ack_status = 'pending'
  RETURNING * INTO worker_booking_record;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No pending assignment found for this booking';
  END IF;
  
  -- Log the acknowledgment
  INSERT INTO sms_logs (booking_id, recipient_number, message, status, error_message)
  VALUES (p_booking_id, 'system', 'Worker acknowledged assignment', 'sent', NULL);
  
  RETURN TRUE;
END;
$function$;

-- Create function to reassign expired acknowledgments
CREATE OR REPLACE FUNCTION public.reassign_expired_acknowledgments()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  expired_booking RECORD;
  result jsonb := '{"reassigned":0,"errors":0}'::jsonb;
BEGIN
  FOR expired_booking IN
    SELECT wb.booking_id, wb.worker_id
    FROM worker_bookings wb
    WHERE wb.ack_status = 'pending'
      AND wb.ack_deadline < now()
  LOOP
    BEGIN
      -- Mark as expired
      UPDATE worker_bookings 
      SET ack_status = 'expired'
      WHERE booking_id = expired_booking.booking_id 
        AND worker_id = expired_booking.worker_id;
      
      -- Remove worker assignment from booking
      UPDATE bookings 
      SET worker_id = NULL, status = 'pending'
      WHERE id = expired_booking.booking_id;
      
      -- Log the reassignment
      INSERT INTO sms_logs (booking_id, recipient_number, message, status, error_message)
      VALUES (expired_booking.booking_id, 'system', 'Assignment expired - reassigning', 'sent', NULL);
      
      -- Trigger auto-assignment
      PERFORM auto_assign_workers_with_coverage(expired_booking.booking_id);
      
      result := jsonb_set(result, '{reassigned}', ((result->>'reassigned')::int + 1)::text::jsonb);
      
    EXCEPTION WHEN OTHERS THEN
      result := jsonb_set(result, '{errors}', ((result->>'errors')::int + 1)::text::jsonb);
      
      INSERT INTO sms_logs (booking_id, recipient_number, message, status, error_message)
      VALUES (expired_booking.booking_id, 'system', 'Failed to reassign expired assignment', 'failed', SQLERRM);
    END;
  END LOOP;
  
  RETURN result;
END;
$function$;