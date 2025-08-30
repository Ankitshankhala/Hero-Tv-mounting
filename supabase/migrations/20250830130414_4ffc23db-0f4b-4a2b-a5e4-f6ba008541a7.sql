
-- 1) Enable auto-archive when a capture completes on transactions
DROP TRIGGER IF EXISTS trg_auto_archive_on_capture ON public.transactions;

CREATE TRIGGER trg_auto_archive_on_capture
AFTER UPDATE OF status ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.auto_archive_booking_on_payment_capture();

-- 2) Enable auto-archive when a booking reaches completed with captured/paid status
DROP TRIGGER IF EXISTS trg_auto_archive_on_completion_and_capture ON public.bookings;

CREATE TRIGGER trg_auto_archive_on_completion_and_capture
AFTER UPDATE OF status, payment_status ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION public.auto_archive_booking_on_completion_and_capture();

-- 3) Backfill: archive existing completed + captured/paid bookings
UPDATE public.bookings
SET is_archived = true,
    archived_at = NOW()
WHERE status = 'completed'
  AND payment_status IN ('completed', 'captured')
  AND COALESCE(is_archived, false) = false;
