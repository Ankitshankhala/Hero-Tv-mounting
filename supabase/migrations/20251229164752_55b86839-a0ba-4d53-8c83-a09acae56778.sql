UPDATE bookings
SET 
  payment_status = 'captured',
  payment_intent_id = 'pi_3Shmc5CrUPkoHWKC0uoFyw6R',
  is_archived = false,
  archived_at = null,
  updated_at = now()
WHERE id = '43ac54b3-5ee9-4e67-b1e0-17d2b5532475';