-- Deactivate 4 workers and clear forward-looking assignments while preserving historical records
WITH targets AS (
  SELECT id FROM public.users
  WHERE lower(email) IN (
    'swingman141414@gmail.com',
    'warrenkjoe@hotmail.com',
    'cutzbychad@gmail.com',
    'joseph.dickson15@yahoo.com'
  )
)
UPDATE public.users
SET is_active = false, updated_at = now()
WHERE id IN (SELECT id FROM targets);

-- Clear weekly availability so they no longer appear as available
DELETE FROM public.worker_availability
WHERE worker_id IN (
  SELECT id FROM public.users
  WHERE lower(email) IN (
    'swingman141414@gmail.com','warrenkjoe@hotmail.com',
    'cutzbychad@gmail.com','joseph.dickson15@yahoo.com'
  )
);

-- Clear future specific schedules
DELETE FROM public.worker_schedule
WHERE worker_id IN (
  SELECT id FROM public.users
  WHERE lower(email) IN (
    'swingman141414@gmail.com','warrenkjoe@hotmail.com',
    'cutzbychad@gmail.com','joseph.dickson15@yahoo.com'
  )
)
AND work_date >= CURRENT_DATE;

-- Release pending reservations & preferred-worker hints on future bookings
UPDATE public.bookings
SET reserved_worker_id = NULL, reservation_expires_at = NULL
WHERE reserved_worker_id IN (
  SELECT id FROM public.users
  WHERE lower(email) IN (
    'swingman141414@gmail.com','warrenkjoe@hotmail.com',
    'cutzbychad@gmail.com','joseph.dickson15@yahoo.com'
  )
)
AND scheduled_date >= CURRENT_DATE;

UPDATE public.bookings
SET preferred_worker_id = NULL
WHERE preferred_worker_id IN (
  SELECT id FROM public.users
  WHERE lower(email) IN (
    'swingman141414@gmail.com','warrenkjoe@hotmail.com',
    'cutzbychad@gmail.com','joseph.dickson15@yahoo.com'
  )
)
AND scheduled_date >= CURRENT_DATE;