ALTER TABLE bookings ALTER COLUMN requires_manual_payment SET DEFAULT false;
UPDATE bookings SET requires_manual_payment = false WHERE requires_manual_payment IS NULL;