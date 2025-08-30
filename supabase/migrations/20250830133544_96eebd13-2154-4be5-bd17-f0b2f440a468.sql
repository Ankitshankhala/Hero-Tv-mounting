
-- 1) Clean up duplicates that would block new unique constraints

-- 1a. worker_bookings: keep the earliest row for each (booking_id, worker_id), delete the rest
WITH wb_dupes AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY booking_id, worker_id
      ORDER BY COALESCE(assigned_at, created_at) ASC, created_at ASC, id ASC
    ) AS rn
  FROM public.worker_bookings
)
DELETE FROM public.worker_bookings wb
USING wb_dupes d
WHERE wb.id = d.id
  AND d.rn > 1;

-- 1b. email_logs (only for worker_assignment): keep earliest row per (booking_id, recipient_email, email_type)
WITH el_dupes AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY booking_id, recipient_email, email_type
      ORDER BY COALESCE(sent_at, created_at) ASC, created_at ASC, id ASC
    ) AS rn
  FROM public.email_logs
  WHERE email_type = 'worker_assignment'
)
DELETE FROM public.email_logs el
USING el_dupes d
WHERE el.id = d.id
  AND d.rn > 1;

-- 2) Uniqueness guarantees

-- 2a. Worker can only be assigned once per booking
ALTER TABLE public.worker_bookings
  ADD CONSTRAINT uq_worker_bookings_booking_worker UNIQUE (booking_id, worker_id);

-- 2b. Only one worker assignment email per booking+recipient+type
-- Note: This supports Supabase upsert onConflict: 'booking_id,recipient_email,email_type'
ALTER TABLE public.email_logs
  ADD CONSTRAINT uq_email_logs_booking_recipient_type UNIQUE (booking_id, recipient_email, email_type);

-- 2c. Ensure idempotency key uniqueness (create if missing)
-- If an index with this signature already exists, this statement is harmless.
CREATE UNIQUE INDEX IF NOT EXISTS uq_idempotency_key_operation
  ON public.idempotency_records (idempotency_key, operation_type);

-- 3) Optional serialization: advisory transaction lock per (booking_id, worker_id)
CREATE OR REPLACE FUNCTION public.acquire_worker_assignment_lock(p_booking_id uuid, p_worker_id uuid)
RETURNS void
LANGUAGE sql
AS $$
  SELECT pg_advisory_xact_lock(
    hashtextextended(p_booking_id::text || '|' || p_worker_id::text, 4242)
  );
$$;

-- 4) Atomic gating function (optional helper)
-- Try to insert a 'pending' worker_assignment email_log once. Returns true if inserted by this call.
CREATE OR REPLACE FUNCTION public.try_insert_worker_assignment_email_log(
  p_booking_id uuid,
  p_recipient_email text,
  p_subject text,
  p_message text
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
  WITH ins AS (
    INSERT INTO public.email_logs (
      booking_id, recipient_email, email_type, subject, message, status
    )
    VALUES (p_booking_id, p_recipient_email, 'worker_assignment', p_subject, p_message, 'pending')
    ON CONFLICT (booking_id, recipient_email, email_type) DO NOTHING
    RETURNING 1
  )
  SELECT EXISTS (SELECT 1 FROM ins);
$$;

-- 5) Trigger: when a worker is assigned, invoke the dispatcher once
CREATE OR REPLACE FUNCTION public.trigger_send_worker_assignment_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $func$
BEGIN
  -- Only on initial assignment rows
  IF NEW.status = 'assigned' THEN
    -- Call the smart email dispatcher using anon key
    PERFORM net.http_post(
      url := 'https://ggvplltpwsnvtcbpazbe.supabase.co/functions/v1/smart-email-dispatcher',
      headers := jsonb_build_object(
        'Content-Type','application/json',
        'Authorization','Bearer ' ||
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' ||
          'eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdndnBsbHRwd3NudnRjYnBhemJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk1MTU5NjIsImV4cCI6MjA2NTA5MTk2Mn0.' ||
          'cbZ4kBKP7odpP9r1Qrg4G6CA8XdW7vLdKsqr6gE0j_Q'
      ),
      body := jsonb_build_object(
        'bookingId', NEW.booking_id::text,
        'workerId', NEW.worker_id::text,
        'emailType', 'worker_assignment',
        'source', 'db_trigger'
      )
    );
  END IF;

  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS trg_send_worker_assignment_email ON public.worker_bookings;

CREATE TRIGGER trg_send_worker_assignment_email
AFTER INSERT ON public.worker_bookings
FOR EACH ROW
EXECUTE FUNCTION public.trigger_send_worker_assignment_email();
