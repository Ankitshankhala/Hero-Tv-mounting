CREATE OR REPLACE FUNCTION public.enforce_capture_before_complete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'completed'
     AND (OLD.status IS DISTINCT FROM 'completed')
     AND COALESCE(NEW.requires_manual_payment, false) = false
     AND NEW.captured_amount IS NULL
     AND COALESCE(NEW.payment_status::text, '') NOT IN ('captured','completed','refunded') THEN
    RAISE EXCEPTION 'REVENUE_GUARD: booking % cannot be completed without captured payment (payment_status=%, captured_amount is null)', NEW.id, NEW.payment_status
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_capture_before_complete ON public.bookings;
CREATE TRIGGER trg_enforce_capture_before_complete
  BEFORE UPDATE OF status ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_capture_before_complete();