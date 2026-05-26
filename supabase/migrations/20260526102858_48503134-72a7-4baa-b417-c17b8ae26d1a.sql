-- Remove workers Michael Davison (no bookings) and Connor (has 43 bookings - soft delete)

DO $$
DECLARE
  v_michael uuid := '187dd38f-42e9-49aa-96e2-f87c46d4168c';
  v_connor  uuid := '3e2e7780-6abd-40f5-a5a2-70286b7496de';
BEGIN
  -- Clear worker-specific data for both
  DELETE FROM public.worker_availability         WHERE worker_id IN (v_michael, v_connor);
  DELETE FROM public.worker_schedule             WHERE worker_id IN (v_michael, v_connor);
  DELETE FROM public.worker_service_areas        WHERE worker_id IN (v_michael, v_connor);
  DELETE FROM public.worker_service_zipcodes     WHERE worker_id IN (v_michael, v_connor);
  DELETE FROM public.worker_coverage_overlays    WHERE worker_id IN (v_michael, v_connor);
  DELETE FROM public.worker_coverage_notifications WHERE worker_id IN (v_michael, v_connor);
  DELETE FROM public.worker_notifications        WHERE worker_id IN (v_michael, v_connor);

  -- Release any future/non-completed reservations so they aren't re-assigned
  UPDATE public.bookings
    SET reserved_worker_id = NULL
    WHERE reserved_worker_id IN (v_michael, v_connor);
  UPDATE public.bookings
    SET preferred_worker_id = NULL
    WHERE preferred_worker_id IN (v_michael, v_connor);

  -- Connor: soft delete (preserve booking history & payroll FK integrity)
  UPDATE public.users
    SET is_active = false,
        role = 'customer'::user_role,
        updated_at = now()
    WHERE id = v_connor;

  -- Michael: hard delete (no booking history)
  DELETE FROM public.users WHERE id = v_michael;
END $$;