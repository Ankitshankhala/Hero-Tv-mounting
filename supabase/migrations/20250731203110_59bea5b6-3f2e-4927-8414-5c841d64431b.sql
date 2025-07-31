-- Manually trigger auto-assignment for existing confirmed bookings without workers
DO $$
DECLARE
  booking_record RECORD;
  assignment_result RECORD;
BEGIN
  -- Find confirmed bookings without assigned workers
  FOR booking_record IN 
    SELECT id, scheduled_date, scheduled_start 
    FROM public.bookings 
    WHERE status = 'confirmed' 
    AND worker_id IS NULL
    ORDER BY created_at DESC
  LOOP
    -- Call the auto-assignment function for each booking
    BEGIN
      PERFORM public.auto_assign_workers_with_coverage(booking_record.id);
      
      -- Log the attempt
      INSERT INTO public.sms_logs (booking_id, recipient_number, message, status)
      VALUES (booking_record.id, 'system', 'Manual auto-assignment triggered', 'sent');
      
    EXCEPTION WHEN OTHERS THEN
      -- Log any errors but continue with other bookings
      INSERT INTO public.sms_logs (booking_id, recipient_number, message, status, error_message)
      VALUES (booking_record.id, 'system', 'Manual auto-assignment failed', 'failed', SQLERRM);
    END;
  END LOOP;
END $$;