
# Add / Remove Services + Final Capture — Hardening Plan

## The single rule

```
Add / Remove services  =  update authorization only
Complete job           =  capture payment only
Job is never completed/archived unless capture succeeds
Old authorization is never cancelled until new one is confirmed
```

Three (and only three) backend actions on `payment-engine`:

| Action | When | Captures? | Completes job? |
|---|---|---|---|
| `modify-authorization` | Worker adds/removes services | No | No |
| `finalize-reauthorization` | After customer confirms card in Stripe popup | No | No |
| `complete-and-capture` | Worker clicks the one final button | Yes | Yes |

---

## What's actually wrong today (confirmed in code)

1. `add-booking-services` correctly delegates to `payment-engine recalculate`, but `AddServicesModal.tsx` then **directly flips the booking to `status = 'completed'` and `is_archived = true`** from the browser (lines ~230–260). With the new DB trigger, this will throw; without it, it leaves authorized-but-completed bookings.
2. The frontend branches on `data.requires_new_payment && data.client_secret`, but `payment-engine recalculate` never returns those fields. When a card refuses off-session re-auth, the worker hits a dead end.
3. `ReauthorizePaymentDialog.tsx` writes to `bookings`, `transactions`, and calls `cancel-payment-intent` directly from the browser. No `payment_version` bump, no atomicity, no DB-side validation. If the user closes mid-flow, Stripe has a new PI but the booking still points at the old one.
4. `payment-engine capture` requires `capturableCents == expectedCents` exactly. After a service removal that didn't reduce the Stripe authorization, this throws — so removes look fine until the worker tries to complete.
5. Stale paths still exist: `InlineStripePaymentForm` references functions that no longer exist (`process-service-addition-payment`, `process-manual-charge`); `PaymentCaptureButton` hides on `bookingStatus === 'completed'` instead of `payment_status === 'captured'`.

---

## Implementation order

### Step 1 — `payment-engine`: rename + extend `recalculate` → `modify-authorization`

In `supabase/functions/payment-engine/index.ts`:

- Add `modify-authorization` as the canonical name. Keep `recalculate` as a thin alias for backward compatibility (for one release).
- Behavior is the existing `recalculate` logic with two changes:
  - **(a) On `authentication_required` / `requires_action`:** Do NOT cancel the old PI. Do NOT overwrite `payment_intent_id`. Persist the new PI id in `last_payment_intent_id`, set `pending_payment_amount = expectedTotal`, and return:
    ```json
    {
      "success": true,
      "action": "requires_customer_action",
      "client_secret": "...",
      "new_payment_intent_id": "pi_new",
      "old_payment_intent_id": "pi_old",
      "old_amount": 200.00,
      "new_amount": 260.00
    }
    ```
  - **(b) On lower-amount removals:** If `expectedTotal < currentPI.amount/100` and the PI is still `requires_capture`, do **nothing to Stripe**. Just record the new expected total and return `{ success: true, action: 'no_op_lower_amount' }`. The lower amount will be captured at completion time.

### Step 2 — `payment-engine`: add `finalize-reauthorization`

New action that the frontend calls **after** Stripe.js confirms the new PI:

```
input:  { bookingId, new_payment_intent_id }

steps:
  1. Auth as worker/admin for booking
  2. Lock booking
  3. Re-fetch new PI from Stripe
  4. Assert pi.status === 'requires_capture'
  5. Re-validate pi.amount == round((sum(booking_services) + tip) * 100)
  6. Atomic UPDATE bookings:
       payment_intent_id        = new_payment_intent_id
       last_payment_intent_id   = old PI id (from booking)
       authorized_amount        = new amount
       payment_status           = 'authorized'
       payment_version          = payment_version + 1
       requires_manual_payment  = false
       pending_payment_amount   = null
       has_modifications        = true
  7. Cancel old PI (best-effort, log if it fails)
  8. Insert/Update transaction row to 'authorized' on the new PI
  9. Audit log
```

### Step 3 — `payment-engine`: relax `complete-and-capture` capture rule

Replace the strict equality:

```ts
if (Math.abs(capturableCents - expectedCents) > 1) throw ...
```

with:

```ts
if (expectedCents > capturableCents) {
  throw new Error('Final amount exceeds authorized amount. Worker must update authorization first.');
}
// capture only what's actually owed
const captured = await stripe.paymentIntents.capture(piId, {
  amount_to_capture: expectedCents,
}, { idempotencyKey: `complete_capture_${bookingId}_v${payment_version}` });
```

This makes service removals safe without a re-authorization round-trip.

Apply the same relaxation to the standalone `capture` action.

### Step 4 — `add-booking-services`: passthrough only, never capture

In `supabase/functions/add-booking-services/index.ts`:

- Call `payment-engine modify-authorization`.
- If `engineResult.action === 'requires_customer_action'`, return that payload to the frontend **without** rolling back the inserted services (the new PI is valid; the customer just needs to confirm).
- If success: return `{ success: true, authorization_updated: true, new_amount, payment_status: 'authorized' }`. **Never** return `amount_captured`. **Never** call capture.

### Step 5 — `worker-remove-services`: safe ordering, no new PI for lower amounts

In `supabase/functions/worker-remove-services/index.ts`:

- Lock booking → snapshot services → calculate new total → call `payment-engine modify-authorization` (which will no-op for lower pre-capture amounts) → only then delete the rows.
- On any payment-engine error, do NOT delete the rows.
- Keep the post-capture `refund-difference` branch as today.
- Keep the zero-total cancel guard.

### Step 6 — Frontend `AddServicesModal.tsx`

- Delete the entire block (current lines ~215–268) that:
  - Reads `data.amount_captured`,
  - Updates `bookings.status = 'completed'`,
  - Updates `is_archived = true`,
  - Toasts "Job Completed Successfully".
- On plain success: toast "Services added. Authorization updated to $X.XX." → `setCart([])` → `onClose()` → `onServicesAdded?.()`.
- Keep the `requires_new_payment` branch but route it through the **rewritten** `ReauthorizePaymentDialog`.
- Confirm/keep button label: **"Add Services & Update Authorization"**.

### Step 7 — Frontend `ReauthorizePaymentDialog.tsx`

Replace the post-confirm logic. After `stripe.confirmCardPayment` returns `requires_capture`:

```ts
await supabase.functions.invoke('payment-engine', {
  body: {
    action: 'finalize-reauthorization',
    bookingId: booking_id,
    new_payment_intent_id: new_payment_intent,
  },
});
```

Remove:
- The direct `supabase.from('bookings').update(...)`.
- The direct `supabase.from('transactions').insert(...)`.
- The direct `supabase.functions.invoke('cancel-payment-intent', ...)`.

On dialog close without confirmation: just toast "Re-authorization not completed — booking still on original $X authorization." Stripe auto-expires unconfirmed PIs.

### Step 8 — Cleanup of stale paths

- `src/components/worker/payment/InlineStripePaymentForm.tsx` — delete (calls non-existent functions; no longer reachable after Step 6).
- `src/pages/WorkerDashboardWithSidebar.tsx` — remove any reference to `capture-payment` (the real function is `capture-payment-intent`, but workers should never call it directly anymore; only `worker-complete-and-capture` is allowed).
- `src/components/worker/RemoveServicesModal.tsx` — sanity check; remove any client-side status writes if found.

### Step 9 — DB trigger (already exists, verify wording)

Confirm `trg_enforce_completed_requires_capture` rejects:

```sql
NEW.status = 'completed' AND NEW.payment_status NOT IN ('captured', 'completed')
```

It was added in the previous round, so this is a verification step, not a new migration.

### Step 10 — Tests

Add E2E + unit tests covering:
- Add service, off-session succeeds → authorization updated, job stays active.
- Add service, card requires action → popup opens → confirm → `finalize-reauthorization` called → booking switched, old PI cancelled.
- Add service, customer cancels popup → booking unchanged, old PI still authorized.
- Remove service pre-capture → no Stripe round-trip, completion later captures lower amount.
- Remove service post-capture → partial refund issued.
- Complete-and-capture: succeeds; double-click is idempotent; cannot run if `payment_status != 'authorized'`.
- DB trigger rejects manual `status='completed'` from the client.

---

## Files changed

**Edge Functions**
- `supabase/functions/payment-engine/index.ts` — add `modify-authorization`, add `finalize-reauthorization`, relax capture amount rule, add lower-amount no-op branch.
- `supabase/functions/add-booking-services/index.ts` — passthrough re-auth handoff, never capture.
- `supabase/functions/worker-remove-services/index.ts` — payment update before DB delete; rely on lower-amount no-op.

**Frontend**
- `src/components/worker/AddServicesModal.tsx` — remove client-side complete/archive; success = "authorization updated".
- `src/components/worker/payment/ReauthorizePaymentDialog.tsx` — call `finalize-reauthorization`; remove all direct DB writes.
- `src/components/worker/RemoveServicesModal.tsx` — sanity verify.
- `src/components/worker/payment/InlineStripePaymentForm.tsx` — delete.
- `src/pages/WorkerDashboardWithSidebar.tsx` — remove stale `capture-payment` references.

**Database**
- No new migration. The `trg_enforce_completed_requires_capture` trigger from the previous round already enforces the invariant.

**Tests**
- New cases in `tests/e2e/add-services-flow.spec.ts` and `tests/integration/addServices.test.ts`.

---

## Out of scope

- Customer-facing booking creation flow.
- Refund admin tooling.
- Tip/coupon recalculation rules.
