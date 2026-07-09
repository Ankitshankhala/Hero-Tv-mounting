# Production Payment Issue — Diagnosis (no code changes)

## TL;DR
The broken flow is **customer-side authorization at checkout**, not worker-side capture. It has been dropping bookings for **at least 9+ days** (well before today's `a7abd4cb` add-booking-services fix), so that commit is **not** the trigger. Captures that do run are still succeeding.

## Evidence

### 1. Edge function logs — payment functions
Queried `payment-engine`, `capture-payment-intent`, `worker-complete-and-capture`, `unified-payment-authorization` for the retained window:
- **Zero log entries returned for all four.** The analytics query for edge URLs matching `payment-engine|capture|authorize` also returned `[]`.
- The only 5xx errors in the recent edge-log window are from `unified-email-dispatcher` (500, "bookingId, recipientEmail, and emailType are required") — a separate email-payload bug, not payment.
- No Stripe 4xx/5xx surfaced; nothing was logged because these functions weren't hit (or hits fall outside the retained window).

### 2. Bookings state — the smoking gun
Recent rows with `payment_status IN ('authorized','pending')`:

Stuck in `status='payment_pending' / payment_status='pending' / payment_intent_id=NULL` (authorization never completed):
```
2026-07-09 12:54  3ab310d4-81e5-…-3aff74ba88a6
2026-07-09 06:13  c85f7401-…-3e030e1595f8
2026-07-09 02:48  471cc882-…-5cbf96390c9b
2026-07-08 22:59  bf0638e6-…-9abf4d259643
2026-07-08 08:40  02e967d0-…-60758f68cd07
2026-07-08 04:23  6c1394fe-…-eefc0bb36924
2026-07-08 00:46  5be19738-…-4433a8366b25
2026-07-08 00:08  a0727395-…-4b9c42098ed7
2026-07-07 22:56  1ff3a266-…-b678b291d524
2026-07-07 19:07  65ae6d20-…-e0b45a995a32
```
None ever got a `payment_intent_id`. The Stripe authorization call either never fired or errored before creating a PI. Pattern started **~Jul 7** — days before commit `a7abd4cb`.

Successful authorizations still occur alongside the failures (`dff309fe` today 13:17, `46cf7c4c` Jul 8, `ace8bd2b` Jul 8, `eccd4d83` Jul 8) → the flow is intermittent, not fully down.

### 3. Worker-side capture — actually working
Recent `transactions.transaction_type='capture'` rows all show `status='completed'` with a `captured_at`:
- `a51ca8b0` captured 2026-07-09 01:43
- `2954af91` captured 2026-07-08 00:04
- `b52d9552` captured 2026-07-07 15:01
- Several more prior — no failed captures observed in the last 20 transactions.

Bookings sitting in `payment_status='authorized'` (`dff309fe`, `46cf7c4c`, `ace8bd2b`, `eccd4d83`, `e5306fb5`) are all scheduled Jul 9–11 — not overdue, not stuck. No captured→failed regression.

### 4. Correlation with today's commit `a7abd4cb`
Not correlated. The `payment_pending`/no-PI pile predates the commit by ~2 days and continues at the same cadence. Today's commit only affects `add-booking-services` (post-authorization service additions) and cannot influence initial checkout authorization.

## Root-cause hypotheses (need confirmation before fixing)
The **authorization** path drops before a PaymentIntent is created:

- **A. Frontend never invokes `unified-payment-authorization`** — checkout error (Stripe.js, card element, form validation, network) leaves the just-created booking in `payment_pending` and bails. Most likely given zero edge-function invocations in retained logs.
- **B. `unified-payment-authorization` is invoked but errors before Stripe** (auth/JWT missing, mode-mismatch between `STRIPE_MODE` / `VITE_STRIPE_MODE`, or 3DS challenge abandoned). Would still show in edge logs if within retention.
- **C. Booking-creation flow writes the row first, and the follow-up authorize call never completes** — a client crash, tab close, or aborted 3DS. `dff309fe` completing today shows the path itself is functional.

## What I need before I can fix
Please confirm which of these to check next (I will not edit anything until you say so):

1. **Reproduce checkout in the preview** with card `4242…` while capturing browser console + network. This will show whether `unified-payment-authorization` is called and what it returns (Hypothesis A vs B).
2. **Query Stripe dashboard directly** for PaymentIntents in the last 48h — do failed/incomplete PIs exist that didn't make it back to our DB? (Hypothesis C.)
3. **Verify secret sync**: `STRIPE_MODE` vs `VITE_STRIPE_MODE`, and `STRIPE_SECRET_KEY` prefix (`sk_live_` vs `sk_test_`). Per memory, these must match and functions need redeployment after secret changes.
4. **Cross-check `unified-email-dispatcher` 500s** — separate defect (`bookingId/recipientEmail/emailType required`) but may be dropping confirmation emails on the few authorizations that succeed; unrelated to the "can't accept payment" report.

## What is NOT broken
- Worker-side capture (`PaymentCaptureButton` → `capture-payment-intent` → `payment-engine`): recent captures completed cleanly.
- Today's `add-booking-services` row-expansion change: no evidence it broke anything; unrelated code path.

## Recommendation
Approve step 1 (live reproduce checkout with network capture) and step 3 (verify Stripe secret/mode sync) first — those will localize the failure to frontend vs. edge function vs. Stripe config within one round-trip.
