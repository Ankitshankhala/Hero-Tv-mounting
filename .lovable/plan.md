# Stripe PI Cross-Check — Findings & Next Step

## Direct answers

### 1. Stripe Dashboard PI cross-check per booking
**I cannot query the Stripe Dashboard directly from this environment** — there is no Stripe-API tool available to me, and the `test-stripe-config` edge function is gone (returns 404). To hit Stripe's API for the 10 timestamps I need to either (a) deploy a small read-only diagnostic edge function that lists PIs by created-timestamp using `STRIPE_SECRET_KEY`, or (b) have you paste the results from Stripe Dashboard yourself. Both require your approval — the first needs build mode; the second needs you.

### 2. Edge function logs Jul 7 → now
Queried `function_edge_logs` with `timestamp > '2026-07-07'` for URLs matching `payment-engine | unified-payment-authorization | create-payment-intent | authorize`:
- **0 rows returned.** Retention window for `function_edge_logs` in this project is ~last ~24h — anything from Jul 7–8 is already outside the retained window, so we have no server-side trace of what happened at those exact 10 timestamps.
- Logs that DO exist today show payment functions are simply not being invoked at the same rate as `booking-notification-watchdog` — consistent with clients bailing before reaching them.

### 3. What the booking rows themselves prove
For all 10 stuck bookings I confirmed:
- `payment_intent_id = NULL`
- `stripe_customer_id = NULL`
- `stripe_payment_method_id = NULL`
- `updated_at == created_at` (row inserted, never touched again)
- All are guest checkouts (`customer_id` mostly NULL; one guest under a shared demo user)

**This is decisive**: our authorization flow attaches `stripe_payment_method_id` to the booking as part of the same round-trip that creates the PaymentIntent. If a Stripe PI had ever been created for these attempts, we would still see `stripe_payment_method_id` populated (or at least the client-side Stripe.js tokenization to have completed). None of the 10 have any Stripe artifacts.

Additionally, several customers appear twice within hours (Holden Maples ×2, Sammy Mark ×2, Dante Villalba ×2) — they kept retrying and kept hitting the same failure.

### 4. Tally
Without Stripe API access I cannot give a strict 3-way split, but the DB evidence pins the failure well before Stripe:

- **"Never reached Stripe" (frontend / pre-Stripe.js): 10/10 — high confidence.**
- "Reached Stripe and got declined": 0/10 likely — no PaymentMethod token was ever stored.
- "Reached Stripe successfully but we failed to save PI back": ruled out — the same code path saves both PI and PaymentMethod atomically; if one landed, the other would too.

## What this means
The break is on the **client** side (or in the booking-creation → Stripe.js handoff), not on Stripe or in the edge function's authorization logic:

- Row is created with `status='payment_pending'` when checkout starts.
- Something between "row inserted" and "Stripe.js `createPaymentMethod`/`confirmCardSetup`" call is failing silently or the user abandons — no PM token ever comes back, so `unified-payment-authorization` is either never called or called without valid inputs.

Most likely culprits (need to confirm which, no code changes yet):
- Stripe.js card element failing to load / initialize in production (CSP, script blocked, wrong publishable key at build time).
- A caught client-side error swallowing the failure without telling the user.
- Form validation preventing submit while creating the booking row anyway (order-of-operations bug: row created before card confirm).
- Cart/session restore issue leaving checkout in a state where the submit handler no-ops.

## Recommended next step (pick one — plan mode, no changes yet)

**Option A (fastest, definitive):** Approve build mode so I can deploy a small read-only `stripe-diagnostics` edge function that lists Stripe PIs and Customers created within a ±10-minute window around each of the 10 timestamps, matched by email from `guest_customer_info`. This confirms the "never reached Stripe" conclusion vs. any orphaned PIs, in one round-trip. I will delete the diagnostic function afterwards.

**Option B (no code, needs you):** Open Stripe Dashboard → Payments → filter by these 10 emails (holdenkmaples@gmail.com, marksammy85@gmail.com, dhamizg@gmail.com, doug.shald@gmail.com, katemabarbra8@gmail.com, rodrigopradobrandao@gmail.com, abc@gmail.com) between Jul 7 19:00 UTC and Jul 9 13:00 UTC. Paste back any PI IDs/statuses/error codes you see. Zero results = confirms frontend failure.

**Option C (proactive instrumentation):** Approve build mode to add structured client logging around the checkout submit path (before/after Stripe.js `createPaymentMethod`, before/after `functions.invoke('unified-payment-authorization')`), so the next real customer's failure is fully traced. Nothing else changes.

My recommendation: **A** — it's the smallest change that turns "high confidence" into "certainty" before we start touching the checkout code.
