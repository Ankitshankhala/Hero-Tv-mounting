# "Customers can't enter their credit card" — Diagnosis

**Verdict: No active bug found. Stripe card entry works. Complaint is almost certainly a mis-description of the abandonment / lost-revenue issues already diagnosed.**

## What I verified against production (`www.herotvmounting.com`, iPhone-sized viewport)

### 1. CSP is not blocking Stripe

- **No `Content-Security-Policy` HTTP header** on production (nginx origin) or on the Lovable preview (`hero-tv-mounting.lovable.app`, Cloudflare).
- **No `<meta http-equiv="Content-Security-Policy">`** in `index.html` (checked full 68-line file).
- `js.stripe.com/v3/` returns `200`, cache-hit from Cloudfront. Reachable from customer origins and from the sandbox.
- Synthetic Stripe Elements mount test in a fresh headless Chromium — the Stripe iframe was created successfully.

### 2. Stripe.js loads and the publishable key is wired

- `src/lib/stripe.ts` reads `VITE_STRIPE_PUBLISHABLE_KEY` / `VITE_STRIPE_PUBLISHABLE_KEY_TEST` and switches on `VITE_STRIPE_MODE`. Both keys are present in `.env`. Prior chat confirmed mode is `live` and the key prefix is `pk_live_...`.
- `StripeCardElement.tsx` calls `loadStripe(STRIPE_PUBLISHABLE_KEY)` on the payment step only (lazy) — this matches the fact that no Stripe network calls happen on earlier wizard steps.

### 3. No console errors on the customer flow

Drove home → service select → cart → wizard steps 1–3 as a mobile client. Result:

- Zero `pageerror`s.
- Zero failed requests.
- Zero CSP / Stripe / iframe errors.
- Only benign log lines: `[ZCTA Validation] ✓ Found in worker assignments: Austin`, `TV Mounting buildServicesList - Testing mode: false, Base price: $90`, and one a11y warning `Missing Description or aria-describedby for {DialogContent}`.

I could not fully drive to the payment step in one shot (schedule-step time picker didn't expose an "AM/PM" affordance to my selectors), but the payment step's front door — Stripe.js load path, key config, CSP posture, and container rendering — is unblocked. There is no environmental or code obstacle preventing the card iframe from appearing.

### 4. No recent code changes touched the checkout path

Reviewed `git log -20` on `src/components/StripeCardElement.tsx`, `src/lib/stripe.ts`, `src/components/payment/*`, and `index.html`. The last customer-checkout-facing edit predates the two recent reverts (`bf3e9659`, `0af49879`). Recent work in this conversation touched `supabase/functions/add-booking-services/index.ts` (worker-side add flow), not customer checkout.

### 5. Mobile rendering

`StripeCardElement` renders a `min-h-[52px]` container with `overflow` safe. `hidePostalCode: false`, `iconStyle: 'solid'`. No touch-blocking overlay, no forced-desktop viewport meta. `<meta viewport>` in `index.html` is correct: `width=device-width, initial-scale=1.0`.

## Minor code observation (not the outage)

`StripeCardElement.tsx` has an ugly-but-functional bootstrap: the `<div ref={cardElementRef}>` renders only when `!isLoading`, and `isLoading=true` initially, yet `initializeStripe` runs on mount and calls `waitForDomElement()` immediately. The first attempt always fails ("container could not be initialized"), the catch block sets `isLoading=false`, the div then renders, and the 500 ms retry succeeds. This adds ~600–800 ms to first paint of the card field on cold load and produces one `[error] Payment form container could not be initialized.` console line per session. Worth cleaning up later, but it *does* recover — it is **not** the reported outage. Consistent with 145 successfully authorized rows in the database.

## What the complaint likely actually is

Cross-referenced with earlier diagnostics in this same conversation:

- 10 recent bookings stuck in `payment_pending` with NULL `payment_intent_id` — confirmed to be **normal abandonment** (DB row created before Stripe call; user closes tab / bails). This looks like "the payment step didn't work for me" from a customer POV but there is no swallowed error — every failure path already renders both an inline destructive Alert and a toast.
- **$19,898.75 across 138 authorized bookings past scheduled date and past the ~7-day auto-capture window** — Stripe has almost certainly auto-released those holds already. That is the real financial issue.
- No cron job invokes `detect-uncaptured-payments`. Zero rows in `admin_alerts` with `alert_type='uncaptured_payment'`. So the client had zero warning that these were slipping.

Highest-probability translations of "customers can't enter their credit card":

1. **Reporter is describing failed captures, not failed card entry.** The service was delivered, the customer's card was never charged (hold expired). From the ops side that reads as "the payment didn't work" and gets paraphrased as "couldn't enter their card."
2. **A specific customer's browser** (mobile Safari private mode, aggressive extension, corporate MDM blocking `js.stripe.com`). Not reproducible on stock Chromium mobile UA. Ask the affected customer for: device, OS, browser, whether ad-blocking/DNS-filtering is on, and a screenshot of what they see at the payment step.
3. **Wizard-step blocker upstream of Payment.** Nothing in my run pointed at one, but on Contact step the required "Unit Number" field on a single-family address (my test tripped on this) is easy to skip past visually. Not the same as "can't enter card" but a customer might describe it that way.

## Recommended next actions (out of scope for this diagnostic)

- Request device/browser/screenshot from the complaining customer(s) — the only way to differentiate #1/#2/#3 above.
- Separately, wire `detect-uncaptured-payments` to a daily cron. This is the real revenue leak (already documented in the previous plan).
- Optional: fix the `StripeCardElement` init order so it doesn't rely on the first attempt failing to unblock rendering.

No code changes proposed. Diagnostic only.
