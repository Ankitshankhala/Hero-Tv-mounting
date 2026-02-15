

# Payment Engine Refactor -- Full Implementation Plan

## Overview

This refactor consolidates 7+ independent Stripe PaymentIntent creators into a single authoritative `payment-engine` edge function. This permanently eliminates duplicate PIs, amount mismatches, test pricing leaks, and race conditions.

---

## Step 1: Database Migration

Add 4 columns to `bookings` and create a row-locking function:

```sql
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_version integer NOT NULL DEFAULT 1;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS authorized_amount numeric;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS captured_amount numeric;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS last_payment_intent_id text;

CREATE OR REPLACE FUNCTION lock_booking_for_payment(p_booking_id uuid)
RETURNS TABLE(
  id uuid, payment_intent_id text, stripe_customer_id text,
  stripe_payment_method_id text, tip_amount numeric, payment_status text,
  payment_version integer, authorized_amount numeric, captured_amount numeric,
  last_payment_intent_id text
) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT b.id, b.payment_intent_id, b.stripe_customer_id,
         b.stripe_payment_method_id, b.tip_amount, b.payment_status::text,
         b.payment_version, b.authorized_amount, b.captured_amount,
         b.last_payment_intent_id
  FROM bookings b WHERE b.id = p_booking_id
  FOR UPDATE NOWAIT;
EXCEPTION
  WHEN lock_not_available THEN
    RAISE EXCEPTION 'Booking is currently being modified. Please try again.';
END;
$$;
```

---

## Step 2: Create `supabase/functions/payment-engine/index.ts`

New edge function (~400 lines) -- the ONLY place allowed to call Stripe PI create/cancel/capture/refund. Handles 5 operations via `action` parameter:

- **authorize**: Guest checkout. Calculates total from `booking_services`, validates tip, creates PI with `capture_method: manual`, stores `payment_intent_id`/`authorized_amount`/`tip_amount` synchronously. Idempotency key: `authorize_{bookingId}_v{version}`. No JWT required.

- **recalculate**: Pre-capture service changes. Acquires row lock, calculates new total from DB, cancels old PI (saving to `last_payment_intent_id`), creates new PI with incremented version. If creation fails, sets `requires_manual_payment = true`. Idempotency key: `recalc_{bookingId}_v{new_version}`. Requires worker/admin JWT.

- **capture**: Finalizes payment. Rejects if DB total != Stripe `amount_capturable` (forces recalculate first). Stores `captured_amount`. Requires worker/admin JWT.

- **charge-difference**: Post-capture additions. Calculates `new_total - captured_amount` from DB. Creates auto-captured PI. Idempotency key: `charge_{bookingId}_v{version}`. Requires worker/admin JWT.

- **refund-difference**: Post-capture removals. Receives `removed_services` with `service_id`/`quantity`, looks up official price from `services` table (never trusts caller's price), creates Stripe refund. Idempotency key: `refund_{bookingId}_v{version}`. Requires worker/admin JWT.

---

## Step 3: Update `supabase/config.toml`

Add:
```toml
[functions.payment-engine]
verify_jwt = false
```

---

## Step 4: Update `unified-payment-authorization/index.ts`

- Remove `amount` from request body (line 28)
- Remove amount validation (lines 42-48)
- Accept `tip` (optional, default 0)
- Delegate to payment-engine `authorize` instead of calling Stripe directly (lines 100-160)

---

## Step 5: Update `create-guest-booking/index.ts`

- Fix pricing leak: before building `serviceInserts` (line 148-155), fetch real `base_price` from `services` table by `service.id`
- Use DB price instead of `service.price` from frontend

---

## Step 6: Update `add-booking-services/index.ts` (383 lines -> ~120 lines)

- Fix pricing leak: fetch real `base_price` from `services` table by `service_id`, ignore frontend `s.price` (line 57-58, 76)
- Remove ALL `stripe.paymentIntents.create()` calls (lines 103, 266, 308)
- Remove ALL `stripe.paymentIntents.cancel()` calls (line 128)
- Remove Stripe import entirely (line 3)
- After DB insert of services, call `supabase.functions.invoke('payment-engine', { body: { action: 'recalculate', bookingId, modification_reason: 'service_addition' } })`
- On recalculate failure, rollback inserted services by deleting them
- Preserve existing error handling structure and response format

---

## Step 7: Update `worker-remove-services/index.ts` (610 lines -> ~250 lines)

- Remove `calculateServicePrice` function with hardcoded wrong prices ($50/$75/$30 vs real $25/$40/$40) (lines 128-143)
- Remove ALL direct Stripe PI create/cancel/refund calls (lines 269-560)
- Remove Stripe import (line 3)
- Keep: idempotency check (lines 46-74), service fetching (lines 100-114), deletion (lines 153-156), invoice updates (lines 162-235), modification records (lines 244-261)
- After DB operations, check `booking.payment_status`:
  - If `authorized` (pre-capture): call payment-engine `recalculate`
  - If `captured` (post-capture): call payment-engine `refund-difference` with `removed_services` containing `service_id`, `service_name`, `base_price`, `quantity` from in-memory snapshot

---

## Step 8: Update `capture-payment-intent/index.ts` (291 lines -> ~80 lines)

- Remove the `sync-payment-after-modification` invocation block (lines 98-127)
- Remove "capture anyway on mismatch" logic (lines 140-148)
- Delegate to payment-engine `capture` action
- Engine returns error "Booking total changed. Recalculate payment first." if mismatch

---

## Step 9: Update `sync-payment-after-modification/index.ts` (373 lines -> ~30 lines)

- Remove all direct Stripe logic (lines 140-348)
- Becomes thin proxy: call payment-engine `recalculate` and return its response

---

## Step 10: Update `charge-saved-payment-method/index.ts` (127 lines -> ~30 lines)

- Remove `amount` from request body (line 19)
- Remove direct `stripe.paymentIntents.create()` (lines 44-56)
- Delegate to payment-engine `charge-difference` with only `bookingId`

---

## Step 11: Frontend Updates

### `PaymentAuthorizationForm.tsx` (line 215)
- Remove `amount: amount` from request body
- Add `tip: 0` (tip comes from the booking flow state)
- Keep `amount` prop for display only

### `SimplePaymentAuthorizationForm.tsx` (line 207)
- Same: remove `amount`, add `tip: 0`

### `AddServicesModal.tsx` (line 166)
- Remove `price: item.price` from services array
- Only send `id`, `name`, `quantity`, `configuration`

### `PaymentAuthorizationCard.tsx` (line 84-86)
- Remove `amount` from request body sent to `create-payment-intent`
- Update to use `unified-payment-authorization` instead of `create-payment-intent`

### `EnhancedInlineBookingFlow.tsx` (line 545)
- The `amount` prop on `PaymentAuthorizationForm` stays for display; the form internally no longer sends it

### `EnhancedInvoiceModificationModal.tsx` (lines 247, 411)
- Calls to `sync-payment-after-modification` continue to work (it becomes a thin proxy)
- Calls to `add-booking-services` continue to work (it now delegates to engine)

---

## Step 12: Create `src/utils/retryOnLock.ts`

```typescript
export async function retryOnLock<T>(
  fn: () => Promise<T>,
  maxRetries = 2,
  delayMs = 750
): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      const msg = error?.message || error?.error || '';
      if (msg.includes('currently being modified') && attempt < maxRetries) {
        await new Promise(r => setTimeout(r, delayMs));
        continue;
      }
      throw error;
    }
  }
  throw new Error('Max retries exceeded');
}
```

Apply to these components:
- `AddServicesModal.tsx` -- wrap the `add-booking-services` invoke
- `RemoveServicesModal.tsx` -- wrap the `worker-remove-services` invoke
- `EnhancedInvoiceModificationModal.tsx` -- wrap the `sync-payment-after-modification` and `worker-remove-services` invokes
- `useRealTimeInvoiceOperations.tsx` -- wrap the `worker-remove-services` invoke

---

## Implementation Sequence

1. SQL migration (4 columns + locking function)
2. Create `payment-engine/index.ts`
3. Update `config.toml`
4. Update `unified-payment-authorization` (delegate authorize)
5. Update `create-guest-booking` (fix pricing leak)
6. Update `add-booking-services` (fix pricing + delegate recalculate)
7. Update `worker-remove-services` (remove hardcoded prices + delegate)
8. Update `capture-payment-intent` (delegate capture)
9. Update `sync-payment-after-modification` (thin proxy)
10. Update `charge-saved-payment-method` (delegate)
11. Create `retryOnLock.ts` utility
12. Update frontend forms (remove amount/price from payloads, add retry)

---

## Safety Guarantees

| Guarantee | Mechanism |
|---|---|
| Only ONE active PI per booking | Action-specific idempotency keys with `payment_version` |
| No amount manipulation | All amounts from `booking_services` table |
| No duplicate PIs from concurrency | `SELECT ... FOR UPDATE NOWAIT` row lock |
| No testing-mode price leaks | `base_price` fetched from `services` table server-side |
| Captured PIs never canceled | Engine checks PI status before cancel |
| Cancel-before-create ordering | Old PI canceled first; if new fails, booking flagged |
| Wrong-amount capture prevented | Capture rejects if DB total != Stripe amount |
| Refund amounts tamper-proof | Engine looks up price by `service_id` from `services` table |
| Sensitive operations auth-gated | JWT + role validation for all non-authorize actions |
| Old PI traceable for debugging | `last_payment_intent_id` preserved before overwrite |
| Lock collisions handled gracefully | Frontend retries with 750ms delay, up to 2 attempts |

