CREATE OR REPLACE FUNCTION public.enforce_completed_requires_capture()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'completed'
     AND NEW.payment_status NOT IN ('captured', 'completed') THEN
    RAISE EXCEPTION
      'Completed booking must have captured payment (got payment_status=%)',
      NEW.payment_status
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_completed_requires_capture ON public.bookings;

CREATE TRIGGER trg_enforce_completed_requires_capture
  BEFORE INSERT OR UPDATE OF status, payment_status ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_completed_requires_capture();