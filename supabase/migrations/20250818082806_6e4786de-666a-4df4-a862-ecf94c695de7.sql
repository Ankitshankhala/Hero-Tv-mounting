
-- 1) New canonical timezone-aware fields
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS start_time_utc timestamptz,
  ADD COLUMN IF NOT EXISTS service_tz text,
  ADD COLUMN IF NOT EXISTS local_service_date date,
  ADD COLUMN IF NOT EXISTS local_service_time time without time zone;

-- 2) Trigger function to keep time fields in sync
CREATE OR REPLACE FUNCTION public.maintain_booking_time_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  local_ts timestamp without time zone;
BEGIN
  -- Default service timezone (configurable later)
  IF COALESCE(NEW.service_tz, '') = '' THEN
    NEW.service_tz := 'America/Chicago';
  END IF;

  -- Determine authoritative local timestamp for the service location
  IF NEW.local_service_date IS NOT NULL AND NEW.local_service_time IS NOT NULL THEN
    local_ts := (NEW.local_service_date::text || ' ' || NEW.local_service_time::text)::timestamp without time zone;

  ELSIF NEW.scheduled_date IS NOT NULL AND NEW.scheduled_start IS NOT NULL THEN
    -- Backward compatibility: use legacy fields when present
    local_ts := (NEW.scheduled_date::text || ' ' || NEW.scheduled_start::text)::timestamp without time zone;

  ELSIF NEW.start_time_utc IS NOT NULL THEN
    -- Derive local wall time from canonical UTC + service timezone
    local_ts := NEW.start_time_utc AT TIME ZONE NEW.service_tz;
  END IF;

  -- If we have a local wall-time, ensure all fields are in sync
  IF local_ts IS NOT NULL THEN
    -- Authoritative local fields
    NEW.local_service_date := DATE(local_ts);
    NEW.local_service_time := CAST(local_ts AS time);

    -- Canonical UTC instant for the start
    NEW.start_time_utc := local_ts AT TIME ZONE NEW.service_tz;

    -- Mirror back to legacy fields for backward compatibility if missing
    IF NEW.scheduled_date IS NULL THEN
      NEW.scheduled_date := DATE(local_ts);
    END IF;
    IF NEW.scheduled_start IS NULL THEN
      NEW.scheduled_start := CAST(local_ts AS time);
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- 3) Create trigger on INSERT/UPDATE of any time-bearing field
DROP TRIGGER IF EXISTS trg_maintain_booking_time_fields ON public.bookings;

CREATE TRIGGER trg_maintain_booking_time_fields
  BEFORE INSERT OR UPDATE OF scheduled_date, scheduled_start, local_service_date, local_service_time, service_tz, start_time_utc
  ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.maintain_booking_time_fields();

-- 4) Backfill existing rows
UPDATE public.bookings
SET service_tz = 'America/Chicago'
WHERE service_tz IS NULL;

UPDATE public.bookings
SET
  local_service_date = COALESCE(local_service_date, scheduled_date),
  local_service_time = COALESCE(local_service_time, scheduled_start)
WHERE local_service_date IS NULL
   OR local_service_time IS NULL;

UPDATE public.bookings
SET start_time_utc = (
  (COALESCE(local_service_date, scheduled_date)::text || ' ' || COALESCE(local_service_time, scheduled_start)::text)::timestamp without time zone
) AT TIME ZONE COALESCE(service_tz, 'America/Chicago')
WHERE start_time_utc IS NULL
  AND COALESCE(local_service_date, scheduled_date) IS NOT NULL
  AND COALESCE(local_service_time, scheduled_start) IS NOT NULL;

-- 5) Index for querying/sorting by UTC start
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_bookings_start_time_utc'
  ) THEN
    CREATE INDEX idx_bookings_start_time_utc ON public.bookings(start_time_utc);
  END IF;
END$$;
