
-- Ensure trigger for auto-archiving when booking is completed and payment is captured
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_auto_archive_on_completion_and_capture'
  ) THEN
    CREATE TRIGGER trg_auto_archive_on_completion_and_capture
    BEFORE UPDATE ON public.bookings
    FOR EACH ROW
    EXECUTE FUNCTION public.auto_archive_booking_on_completion_and_capture();
  END IF;
END$$;

-- Ensure trigger for auto-archiving when a capture transaction is marked completed
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_auto_archive_on_payment_capture'
  ) THEN
    CREATE TRIGGER trg_auto_archive_on_payment_capture
    AFTER UPDATE ON public.transactions
    FOR EACH ROW
    EXECUTE FUNCTION public.auto_archive_booking_on_payment_capture();
  END IF;
END$$;
