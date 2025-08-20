-- Archive the E2E Test Customer booking
UPDATE public.bookings
SET is_archived = true, archived_at = now(), updated_at = now()
WHERE id = '66ed80a8-4787-498f-839a-ff830cd47327';