-- Sync transaction with Stripe captured state
UPDATE transactions 
SET 
  status = 'completed',
  transaction_type = 'capture',
  captured_at = '2025-12-15T07:03:00Z'
WHERE payment_intent_id = 'pi_3Sd0lHCrUPkotWKC1aRKK30j'
  AND booking_id = 'b6fa05bb-23f6-4806-b26f-bed39f2e2c29';

-- Sync booking with Stripe captured state
UPDATE bookings 
SET 
  payment_status = 'captured',
  payment_intent_id = 'pi_3Sd0lHCrUPkotWKC1aRKK30j'
WHERE id = 'b6fa05bb-23f6-4806-b26f-bed39f2e2c29'
  AND payment_status = 'authorized';