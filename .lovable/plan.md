# Root Cause: `payment_pending` bookings with NULL `payment_intent_id`

**Verdict: Expected customer-abandonment artifacts. Not a silent-failure bug.**

The flow is deliberately DB-first, Stripe-second, and every failure path surfaces a visible error to the user. The stuck rows are what this architecture is *designed* to leave behind when a user bails between the two steps.

---

## 1. Order of operations (evidence)

`src/hooks/booking/useBookingOperations.ts` — booking row is INSERTed **before** any Stripe call:

- **Guest** (line 404): `supabase.functions.invoke('create-guest-booking', { bookingData })` — inserts row with `status='payment_pending'`, `payment_status='pending'`, `stripe_payment_intent_id=NULL`.
- **Authenticated** (line 430): `supabase.from('bookings').insert(bookingData)` — same shape.
- Line 392 logs it explicitly: `Creating booking with status: payment_pending`.
- Booking id is persisted to `sessionStorage` (line 500) so the user can resume.

**Then** `PaymentStep` (`src/components/booking/PaymentStep.tsx`) renders and only there does Stripe get called, via `SimplePaymentAuthorizationForm` → `stripe.createPaymentMethod` → `unified-payment-authorization` (which delegates to `payment-engine`) → engine writes `stripe_payment_intent_id` back to the row.

Anything that interrupts the customer between "booking row created" and "authorize succeeds" (tab close, back button, network drop, giving up on the card form, card decline they don't retry) leaves exactly the observed artifact: `payment_pending` + NULL PI. That matches all 10 stuck rows from the earlier database check.

## 2. Error handling is NOT silent

`SimplePaymentAuthorizationForm.tsx` `handleSubmit` (lines 165–338) handles every branch with **both** an inline error alert and a callback:

| Failure                                    | User sees                                                  |
| ------------------------------------------ | ---------------------------------------------------------- |
| Stripe.js not ready / card incomplete      | `setFormError` + toast via `onAuthorizationFailure`        |
| `createPaymentMethod` error                | Friendly message from `getErrorMessage()` + toast (218–228)|
| 3DS challenge fails                        | Friendly message + toast (258–268)                         |
| 3DS finalize fails                         | Error alert + toast (285–290)                              |
| Engine `success:false` (incl. Stripe card errors, decline codes) | Mapped via `getErrorMessage(stripe_error)` + toast (303–322) |
| Thrown / timeout                           | catch block sets `formError` + toast (329–338)             |

The destructive `<Alert>` renders inline with a "Try Again" button (up to 3 retries) and a support-contact hint. There is no swallowed-error path — every early `return` sets both `formError` and calls `onAuthorizationFailure`, and `PaymentStep.handleAuthorizationFailure` shows a `useToast` destructive toast on top of that.

## 3. Recovery / resume path exists (and works)

- **Session resume:** `EnhancedInlineBookingFlow.tsx` (lines 117–147) reads `pendingBookingId` from `sessionStorage` on mount, verifies the row is still `payment_pending`, and re-enters the flow at the payment step. If the customer just closed the tab in the same browser session, they land back on the same booking.
- **Duplicate prevention:** `useBookingOperations.ts` line 314 calls `find_existing_pending_booking` RPC by email/zip/date/time before insert, so a returning customer reuses the same row instead of piling up duplicates.
- **TTL cleanup:** `cleanup_expired_pending_bookings` RPC (migration `20250807111300`) is invoked by the `cleanup-pending-bookings` edge function with a **180-minute grace period**. After 3h, expired `payment_pending` rows are removed. This is why the 10 stuck rows are still visible — they're either <3h old, or the cleanup cron isn't running.

**Gap:** resume only works from the same browser (sessionStorage). A customer who abandons on mobile Safari and returns tomorrow from desktop has no self-serve path — they'd have to start over (which the dedupe RPC handles gracefully). Not a bug, just an unrecoverable state from the customer's perspective until cleanup sweeps.

## 4. Answer to the framing question

> *Is this normal abandonment, or a silent-fail bug where customers think they're done?*

**Normal abandonment.** Concrete reasons this is not a silent-fail bug:

1. The booking success page is only reached via `onPaymentAuthorized` in `PaymentStep`, which fires **only after** `authData.payment_intent_id` is present (line 328 of the form). A user cannot see "success" without a real PI.
2. Every Stripe/engine error path both renders an inline destructive alert **and** invokes the parent toast — no console-only failures.
3. The stuck rows all have `updated_at === created_at` (per the earlier DB check), meaning the payment step's write-back was never triggered. Consistent with the user never submitting the card form, not with a swallowed post-submit error.

## 5. Recommended follow-ups (out of scope for this diagnostic)

- Verify the `cleanup-pending-bookings` function is on a cron / scheduled trigger — if it's not running, stuck rows accumulate forever and skew the "stuck bookings" signal.
- Optional UX: an email-token "Complete your booking" link for cross-device resume (currently sessionStorage-only).
- Optional analytics: log a client-side event when `PaymentStep` mounts vs. when `onAuthorizationSuccess` fires — the delta is your true abandonment rate and would end this ambiguity permanently.

No code changes proposed. Diagnostic only.
