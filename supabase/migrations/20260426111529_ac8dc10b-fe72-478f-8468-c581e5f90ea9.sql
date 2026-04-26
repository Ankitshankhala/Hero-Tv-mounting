-- Guard: a booking can only become status='completed' when its payment is actually captured.
-- Allows legacy payment_status='completed' for backward compatibility with old rows.
CREATE OR REPLACE FUNCTION public.enforce_completed_requires_capture()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only enforce when status is being changed TO 'completed'
  IF NEW.status::text = 'completed'
     AND (OLD.status IS DISTINCT FROM NEW.status) THEN

    IF NEW.payment_status IS NULL
       OR NEW.payment_status NOT IN ('captured', 'completed') THEN
      RAISE EXCEPTION
        'Cannot mark booking % as completed: payment_status must be captured (got: %)',
        NEW.id, COALESCE(NEW.payment_status, 'null')
      USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_completed_requires_capture ON public.bookings;

CREATE TRIGGER trg_enforce_completed_requires_capture
BEFORE UPDATE ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION public.enforce_completed_requires_capture();