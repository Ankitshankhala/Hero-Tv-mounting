
-- 1) Trigger the worker assignment email send for the specific booking/worker
SELECT 
  net.http_post(
    url := 'https://ggvplltpwsnvtcbpazbe.supabase.co/functions/v1/send-worker-assignment-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdndnBsbHRwd3NudnRjYnBhemJlIiwicm9zZSI6ImFub24iLCJpYXQiOjE3NDk1MTU5NjIsImV4cCI6MjA2NTA5MTk2Mn0.cbZ4kBKP7odpP9r1Qrg4G6CA8XdW7vLdKsqr6gE0j_Q'
    ),
    body := jsonb_build_object(
      'bookingId', 'a3f479c5-97b5-4efd-92f3-05ce9e5512b3',
      'workerId', '3e2e7780-6abd-40f5-a5a2-70286b7496de'
    )
  ) as send_worker_email_result;

-- 2) Show the latest worker email logs for that booking
SELECT id, recipient_email, subject, status, email_type, created_at
FROM email_logs
WHERE booking_id = 'a3f479c5-97b5-4efd-92f3-05ce9e5512b3'
  AND email_type = 'worker_assignment'
ORDER BY created_at DESC
LIMIT 5;
