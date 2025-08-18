-- Add unique index to email_logs for database-level duplicate prevention
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_logs_booking_recipient_type 
ON public.email_logs (booking_id, recipient_email, email_type) 
WHERE status = 'sent';

-- Schedule automated watchdog cron job to check recent bookings every 5 minutes
SELECT cron.schedule(
  'booking-notification-watchdog-auto',
  '*/5 * * * *', -- Every 5 minutes
  $$
  DO $$
  DECLARE
    booking_record RECORD;
  BEGIN
    -- Check bookings from last 30 minutes that might need watchdog attention
    FOR booking_record IN
      SELECT id
      FROM public.bookings 
      WHERE created_at >= NOW() - INTERVAL '30 minutes'
        AND created_at <= NOW() - INTERVAL '5 minutes'  -- Grace period
        AND status IN ('confirmed', 'payment_authorized')
        AND (payment_status IN ('authorized', 'completed', 'captured'))
    LOOP
      -- Call watchdog for each booking
      PERFORM net.http_post(
        url := 'https://ggvplltpwsnvtcbpazbe.supabase.co/functions/v1/booking-notification-watchdog',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdndnBsbHRwd3NudnRjYnBhemJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk1MTU5NjIsImV4cCI6MjA2NTA5MTk2Mn0.cbZ4kBKP7odpP9r1Qrg4G6CA8XdW7vLdKsqr6gE0j_Q'
        ),
        body := jsonb_build_object('bookingId', booking_record.id::text)
      );
    END LOOP;
  END $$;
  $$
);