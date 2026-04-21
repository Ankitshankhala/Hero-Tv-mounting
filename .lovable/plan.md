

# Let workers capture authorized payments (the existing button isn't enough)

## What's already there
The worker dashboard already has a **Charge** button (`PaymentCaptureButton.tsx`) that calls the `capture-payment-intent` edge function. It works — but it only appears when **all** of these are true:
1. `job.status === 'completed'` 
2. `job.payment_status === 'authorized'` (or `capture_failed`)

It also calls capture automatically inside **Mark Complete** (`JobActions.handleMarkComplete`).

## Why workers still can't charge the two stuck bookings
For Henry's and Connor's bookings the payment is `authorized` but `status` is still `confirmed` — they never reached `completed`, so the Charge button is never rendered. On top of that, `requires_manual_payment = true` would currently make the capture call fail silently with no clear recovery.

## The fix (3 small changes, no schema changes)

### 1. Show a "Charge" entry point earlier
In `JobActions.tsx` change `canCapturePayment` so the Charge button also shows when:
- `job.payment_status === 'authorized'` AND
- `job.payment_intent_id` is present AND  
- `job.status` is `confirmed`, `in_progress`, or `payment_authorized` (i.e. work is done but worker forgot to tap Mark Complete)

Render it next to **Mark Complete** so the worker has an explicit "Charge now" path. Mark Complete keeps its existing auto-capture behavior.

### 2. Handle `requires_manual_payment = true` gracefully
In `PaymentCaptureButton.tsx`:
- Fetch `requires_manual_payment` alongside `payment_intent_id`
- If `true`, replace the green Charge button with an inline notice + a **"Collect Payment"** button that opens the existing `PaymentCollectionModal` (cash / new link). No more silent failure.

### 3. Auto-recover on Stripe "expired authorization"
In the same component's `handleCapturePayment` catch block:
- If the edge function returns `payment_intent_unexpected_state` or "authorization expired", flip `requires_manual_payment = true` on the booking, re-fetch details, and switch the UI to the Collect Payment flow described above — instead of just showing a red error.

## Files touched
- `src/components/worker/JobActions.tsx` — broaden `canCapturePayment` condition
- `src/components/worker/PaymentCaptureButton.tsx` — read `requires_manual_payment`, render fallback, auto-flag on expired-auth error
- `src/components/worker/payment/PaymentCollectionModal.tsx` — accept an optional `defaultMethod="cash"` prop so the fallback opens straight on the recovery options (no behavior change otherwise)

## Out of scope
- No edge function changes — `capture-payment-intent` already accepts worker calls
- No change to admin capture button or to the Mark Complete auto-capture
- No schema changes

