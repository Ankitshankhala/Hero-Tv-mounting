## Goal

Eliminate the three regressions in the worker payment flow so the rule holds without exception:

> Add/remove services = update authorization only.
> Complete job = capture payment only.
> Job is only completed when capture succeeds.

## Changes

### 1. `src/components/worker/AddServicesModal.tsx`
- **Remove lines ~215–269** (the `amount_captured` safety branch, the `bookings.update({ status: 'completed' })` write, and the `is_archived` write).
- After a successful `add-booking-services` response (no `requires_new_payment`), just:
  - Show toast: "Services added — authorization updated to $X. Complete the job to capture payment."
  - Clear cart, close modal, call `onServicesAdded?.()`.
- Drop the dead `amount_captured` reads from the success toast.

### 2. `src/components/worker/payment/ReauthorizePaymentDialog.tsx`
- After `stripe.confirmCardPayment(client_secret)` succeeds and PI is `requires_capture`, **stop doing direct DB writes**.
- Replace the `cancel-payment-intent` call + `bookings.update({ payment_intent_id })` + `transactions.insert(...)` block with a single call to `payment-engine` action `finalize-reauthorization`, passing `{ booking_id, old_payment_intent, new_payment_intent, new_amount }`.
- The edge function already (a) atomically swaps `payment_intent_id`, (b) bumps `payment_version`, (c) cancels the old PI, (d) writes the audit/transaction rows. The dialog just confirms 3DS and hands off.
- On error, surface the engine's `error` field in the toast.

### 3. `src/components/worker/payment/InlineStripePaymentForm.tsx` and callers
- **Remove its usage from `AddServicesModal.tsx`** (import on line 8, render block on lines 362–384). Add Services no longer needs an inline card form — 3DS reauth is handled exclusively by `ReauthorizePaymentDialog`. Drop the `showPaymentForm`/`paymentData` state and the `handlePaymentSuccess`/`handlePaymentFailure` handlers tied to it.
- **Keep `InlineStripePaymentForm.tsx` and its usage in `PaymentCollectionModal.tsx`** — that's the separate worker payment-recovery flow (no `clientSecret`; takes a brand-new card and goes through `process-manual-charge`). It is not part of the add/remove services flow.
- Inside `InlineStripePaymentForm.tsx`, **delete the `clientSecret` branch** (lines 51–116) and the `clientSecret` prop entirely. After the cleanup it only handles the `process-manual-charge` path, which is its only remaining caller. This removes the rogue `capture-payment-intent` call from the codebase.

### 4. Sanity check
- `rg -n "capture-payment-intent" src/` should only return `PaymentRecoveryTools.tsx` and `admin/PaymentCaptureButton.tsx` (admin tooling — out of scope).
- `rg -n "InlineStripePaymentForm" src/` should only return `PaymentCollectionModal.tsx` and the file itself.
- No client code should write `bookings.payment_intent_id`, `bookings.status='completed'`, or `bookings.is_archived=true` from the Add Services flow.

## Files touched

- `src/components/worker/AddServicesModal.tsx` (delete capture/complete/archive block, drop InlineStripePaymentForm usage and related state)
- `src/components/worker/payment/ReauthorizePaymentDialog.tsx` (replace direct DB writes with `finalize-reauthorization` call)
- `src/components/worker/payment/InlineStripePaymentForm.tsx` (drop `clientSecret` branch + prop)

No backend changes needed — `payment-engine` already exposes `finalize-reauthorization`, `add-booking-services` already returns the reauth handoff payload, and `worker-complete-and-capture` is the only path that may capture.
