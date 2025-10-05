-- Create function to notify worker of assignment via SMS
CREATE OR REPLACE FUNCTION public.notify_worker_assignment()
RETURNS TRIGGER AS $$
BEGIN
  -- Only send SMS if worker was just assigned (changed from NULL to NOT NULL)
  IF OLD.worker_id IS NULL AND NEW.worker_id IS NOT NULL THEN
    -- Call the send-sms-notification edge function asynchronously
    PERFORM net.http_post(
      url := 'https://ggvplltpwsnvtcbpazbe.supabase.co/functions/v1/send-sms-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdndnBsbHRwd3NudnRjYnBhemJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk1MTU5NjIsImV4cCI6MjA2NTA5MTk2Mn0.cbZ4kBKP7odpP9r1Qrg4G6CA8XdW7vLdKsqr6gE0j_Q'
      ),
      body := jsonb_build_object('bookingId', NEW.id::text)
    );
    
    -- Log that notification was triggered
    INSERT INTO public.sms_logs (booking_id, recipient_number, message, status)
    VALUES (NEW.id, 'trigger', 'Worker assignment SMS triggered', 'pending');
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_worker_assigned ON public.bookings;

-- Create trigger to automatically send SMS when worker is assigned
CREATE TRIGGER on_worker_assigned
  AFTER UPDATE ON public.bookings
  FOR EACH ROW
  WHEN (OLD.worker_id IS NULL AND NEW.worker_id IS NOT NULL)
  EXECUTE FUNCTION public.notify_worker_assignment();