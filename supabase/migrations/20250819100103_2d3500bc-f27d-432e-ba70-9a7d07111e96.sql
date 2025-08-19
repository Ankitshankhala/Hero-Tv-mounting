-- Drop the problematic check constraint that prevents booking status updates
ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_payment_status_check;