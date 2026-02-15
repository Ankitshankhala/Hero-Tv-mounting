

# Fix 7 Critical Issues in Payment Engine

## Issue 1: Recalculate violates Cancel-Before-Create

**Problem (lines 268-306):** DB is mutated (last_payment_intent_id, payment_version) BEFORE the Stripe cancel call. If cancel fails, DB state is inconsistent.

**Fix:** Reorder to strict cancel-before-create:
1. Lock booking (already done)
2. Cancel old PI in Stripe
3. Only THEN increment `payment_version` in DB
4. Create new PI
5. Update booking with new PI + last_payment_intent_id in a single final DB write

---

## Issue 2: validateAuth() uses non-existent getClaims()

**Problem (line 56):** `anonClient.auth.getClaims(token)` does not exist in the Supabase JS client for edge runtime.

**Fix:** Replace with `anonClient.auth.getUser(token)`:
```typescript
const { data, error } = await anonClient.auth.getUser(token);
if (error || !data?.user) throw new Error('Invalid auth token');
return data.user.id;
```

---

## Issue 3: handleChargeDifference uses corsHeaders outside scope

**Problem (lines 631-686):** `handleChargeDifference` is defined outside `Deno.serve()` but references `corsHeaders`. While `corsHeaders` is imported at the module level from `../_shared/stripe.ts` (line 2), the function also takes `stripe` and `supabase` as parameters but returns `Response` objects directly.

**Verdict:** This is actually fine -- `corsHeaders` is a module-level import. No change needed here.

---

## Issue 4: add-booking-services blocks captured bookings

**Problem (lines 33-35):** Hard rejects `payment_status === 'captured'`, but the architecture explicitly supports adding services post-capture via `charge-difference`.

**Fix:** Remove the captured block. Instead, after inserting services:
- If `payment_status === 'authorized'` -- call engine `recalculate`
- If `payment_status === 'captured'` -- call engine `charge-difference`
- Rollback on either failure

---

## Issue 5: Refund targets wrong PI

**Problem (lines 589-591):** `refund-difference` refunds against `booking.payment_intent_id`, which may be an authorized (replaced) PI, not the captured one.

**Fix:** For `refund-difference`:
- Query the booking for `captured_amount` and `payment_status`
- Verify `payment_status === 'captured'` (refunds only apply post-capture)
- Find the captured PI from the `transactions` table where `status = 'completed'` and `transaction_type = 'capture'` to get the correct PI
- Alternatively, store `captured_payment_intent_id` on the booking. Simpler approach: since captured bookings should NOT have their `payment_intent_id` overwritten (recalculate only applies pre-capture), we just need to ensure `recalculate` never overwrites PI on captured bookings. This is already the case because recalculate routes captured bookings to charge/refund-difference internally. So `refund-difference` when called directly just needs to verify `payment_status = 'captured'` before proceeding.

**Chosen fix:** Add validation that `booking.payment_status === 'captured'` in refund-difference. Since captured bookings never get their PI overwritten (recalculate routes them to charge/refund), the current PI is always the captured one. Add explicit guard.

---

## Issue 6: Silent price fallback is a security hole

**Problem (lines 570-572):** If `service_id` is not found in the `services` table, the code falls back to using the caller-provided `base_price`. An attacker could send a fake `service_id` with an inflated `base_price` to get a larger refund.

**Fix:** If `officialPrice === undefined`, reject the request:
```typescript
if (officialPrice === undefined) {
  throw new Error(`Service ${rs.service_id} not found. Cannot process refund.`);
}
```

Also apply the same fix in `add-booking-services` (line 62) where it falls back to `s.price ?? 0`.

---

## Issue 7: Capture query missing fields

**Problem (line 431):** The capture query only selects `id, payment_intent_id, payment_status, tip_amount, payment_version` but should also select `captured_amount` for defensive checks and `stripe_customer_id` for completeness.

**Fix:** Add `captured_amount` to the select. Also add a check that no existing completed capture transaction exists (idempotency guard).

---

## Summary of Changes

### `supabase/functions/payment-engine/index.ts`
1. **validateAuth** -- Replace `getClaims` with `getUser`
2. **recalculate** -- Reorder: cancel PI first, then DB updates, then create new PI, then final DB write
3. **refund-difference** -- Reject unknown service_id (no fallback), add `payment_status === 'captured'` guard
4. **capture** -- Add `captured_amount` to booking query

### `supabase/functions/add-booking-services/index.ts`
1. Remove captured booking block (lines 33-35)
2. Route to `recalculate` for authorized bookings, `charge-difference` for captured bookings
3. Reject unknown service_id instead of falling back to caller price (line 62)

### No new files or migrations needed

