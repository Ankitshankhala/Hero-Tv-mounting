
-- Step 1: Backfill authorized_amount on all 6 uncaptured bookings
UPDATE bookings SET authorized_amount = 90    WHERE id = '96be055a-b38e-4de1-acb9-1bef90b27f0c';
UPDATE bookings SET authorized_amount = 215   WHERE id = '59ebdee5-08e7-448d-8411-520053a208f8';
UPDATE bookings SET authorized_amount = 150   WHERE id = 'a0e0d2c8-5621-4b1d-8cea-b6e3fbbe7536';
UPDATE bookings SET authorized_amount = 90    WHERE id = '17379c9a-c4c8-4f8c-9d62-011fd0b57cd8';
UPDATE bookings SET authorized_amount = 366   WHERE id = '05a1c0c7-f337-4328-9762-ba85546f06b6';
UPDATE bookings SET authorized_amount = 98    WHERE id = 'e888d83d-bdc9-4a27-bba9-ed8768201d57';

-- Step 2: Backfill payment_intent_id on simondelagarza booking
UPDATE bookings 
SET payment_intent_id = 'pi_3T0BSICrUPkotWKC1rHs0EqA'
WHERE id = '17379c9a-c4c8-4f8c-9d62-011fd0b57cd8';

-- Step 3: Fix transaction base_amount where it's 0
UPDATE transactions SET base_amount = 90   WHERE booking_id = '96be055a-b38e-4de1-acb9-1bef90b27f0c' AND status = 'authorized' AND base_amount = 0;
UPDATE transactions SET base_amount = 215  WHERE booking_id = '59ebdee5-08e7-448d-8411-520053a208f8' AND status = 'authorized' AND base_amount = 0;
UPDATE transactions SET base_amount = 310  WHERE booking_id = '05a1c0c7-f337-4328-9762-ba85546f06b6' AND status = 'authorized' AND base_amount = 0;
UPDATE transactions SET base_amount = 85   WHERE booking_id = 'e888d83d-bdc9-4a27-bba9-ed8768201d57' AND status = 'authorized' AND base_amount = 0;
