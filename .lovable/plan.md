# Fix Stripe Reauthorization Flow + Harden Payment State Guards

Your audit is correct on all four points. Here's the targeted fix plan — no architectural change, just contract alignment between `payment-engine` ↔ `add-booking-services` ↔ `AddServicesModal` ↔ `ReauthorizePaymentDialog`, plus one DB guard.

## What will change

### 1. `supabase/functions/add-booking-services/index.ts` — forward reauth payload
Currently the engine response (`action`, `client_secret`, `new_payment_intent_id`, `old_payment_intent_id`) is dropped. Update the success response to pass it through so the frontend can open the 3DS popup:

```ts
return new Response(JSON.stringify({
  success: true,
  incremented: true,
  new_amount: newTotal,
  services_added: services.length,
  payment_intent_id: engineResult.new_payment_intent_id || booking.payment_intent_id,
  amount_captured: null,
  // NEW — reauth handoff
  action: engineResult.action,
  requires_new_payment: engineResult.action === 'requires_customer_action',
  client_secret: engineResult.client_secret ?? null,
  old_payment_intent_id: engineResult.old_payment_intent_id ?? null,
  new_payment_intent_id: engineResult.new_payment_intent_id ?? null,
}), ...);
```

Also: when `engineResult.action === 'requires_customer_action'`, do NOT roll back the inserted services — the new PI is already created and waiting for customer confirmation; rollback would orphan the Stripe PI. Only roll back on hard failure.

### 2. `src/components/worker/AddServicesModal.tsx` — fix field names
Change the trigger condition and the data passed into `ReauthorizePaymentDialog`:

```ts
// Line ~188
if (
  (data.action === 'requires_customer_action' || data.requires_new_payment) &&
  data.client_secret
) {
  setReauthorizeData({
    booking_id,
    original_amount,
    new_amount: data.new_amount,
    client_secret: data.client_secret,
    old_payment_intent: data.old_payment_intent_id,   // was data.old_payment_intent
    new_payment_intent: data.new_payment_intent_id,   // was data.new_payment_intent
  });
  // open dialog…
  return;
}
```

### 3. `src/components/worker/payment/ReauthorizePaymentDialog.tsx` — fix finalize call
The `payment-engine` `finalize-reauthorization` branch reads `bookingId` (camelCase) and `new_payment_intent_id`, and runs `validateAuth()` requiring a Bearer token. Update:

```ts
const { data: { session } } = await supabase.auth.getSession();

const { data: finalizeData, error: finalizeError } = await supabase.functions.invoke(
  'payment-engine',
  {
    body: {
      action: 'finalize-reauthorization',
      bookingId: booking_id,                     // was booking_id
      new_payment_intent_id: new_payment_intent, // engine doesn't need old_payment_intent_id
    },
    headers: {
      Authorization: `Bearer ${session?.access_token ?? ''}`,
    },
  }
);
```
(Drop `old_payment_intent_id` and `new_amount` from the body — engine ignores them; keeps payload aligned with engine contract.)

### 4. New migration — block `status=completed` with non-captured payment
Add a hard trigger to eliminate the dangerous `completed + authorized` state (existing trigger from `20250830070837` still permits `authorized`):

```sql
CREATE OR REPLACE FUNCTION public.enforce_completed_requires_capture()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'completed'
     AND NEW.payment_status NOT IN ('captured', 'completed') THEN
    RAISE EXCEPTION
      'Completed booking must have captured payment (got payment_status=%)',
      NEW.payment_status;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_completed_requires_capture ON public.bookings;
CREATE TRIGGER trg_enforce_completed_requires_capture
  BEFORE INSERT OR UPDATE OF status, payment_status ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.enforce_completed_requires_capture();
```

This makes the only legal completion path `worker-complete-and-capture` (which sets `payment_status='captured'` then `status='completed'` in one engine action).

## Out of scope (acknowledged but deferred)

- **Transactional remove-services + refund** — your "medium" issue. Real fix requires a saga/compensation pattern in `worker-remove-services`. We can tackle this in a follow-up; the new `complete-and-capture` flow already prevents the worst case (final capture uses the lower amount, so pre-capture removal is safe).

## Files touched

- `supabase/functions/add-booking-services/index.ts` (response shape + skip rollback on `requires_customer_action`)
- `src/components/worker/AddServicesModal.tsx` (condition + field names)
- `src/components/worker/payment/ReauthorizePaymentDialog.tsx` (finalize body + auth header)
- `supabase/migrations/<new>.sql` (completed-requires-capture trigger)

## Verification after build

1. Test add-services with a 3DS-required test card (`4000 0027 6000 3184`) → popup should appear → confirmation → booking PI swapped, audit log row written.
2. Test add-services with non-3DS card → no popup, authorization silently updated.
3. Try `UPDATE bookings SET status='completed' WHERE payment_status='authorized'` in SQL — should raise the new exception.
4. Worker "Complete Job & Accept Payment" still succeeds end-to-end (capture flips payment_status before status update inside the engine, so trigger passes).
