# Diagnosis: "Customers can't enter credit card"

**Verdict: no evidence of a broken Stripe Elements / CSP / publishable-key bug in the current codebase. The reported symptom most likely maps to the abandonment + uncaptured-authorization issues already diagnosed in previous turns, not a live-blocking rendering failure.**

## Evidence gathered (read-only)

### 1. CSP is not blocking Stripe
- `index.html` contains **no** `<meta http-equiv="Content-Security-Policy">` tag.
- No `_headers`, `netlify.toml`, `vercel.json`, or server-side CSP config exists in the repo.
- `rg "Content-Security-Policy"` across the entire project returns zero matches.
- Conclusion: no CSP directive can be blocking `js.stripe.com`, `api.stripe.com`, or Stripe iframes.

### 2. Stripe publishable-key wiring looks correct
- `src/lib/stripe.ts` reads `VITE_STRIPE_PUBLISHABLE_KEY` / `VITE_STRIPE_PUBLISHABLE_KEY_TEST` and validates `pk_live_` / `pk_test_` prefix against `VITE_STRIPE_MODE`.
- `useStripePayment.tsx`, `StripeCardElement.tsx`, `ReauthorizePaymentDialog.tsx` all call `loadStripe(STRIPE_PUBLISHABLE_KEY)` — standard pattern.
- Admin diagnostics (`LivePaymentValidator`, `StripeConfigTest`, `StripeConfigStatus`) surface a missing/mismatched key.
- If the key were missing, `stripe.ts` throws a loud console error at load — none observed in the preview session.

### 3. Live preview console is clean
Loaded `http://localhost:8080/` in headless Chromium. Console output: `[vite] connected`, React Router future-flag warnings (harmless), `Auth state change: INITIAL_SESSION undefined`, `ZIP index loaded: 444 entries`. **Zero** page errors, zero failed requests, zero CSP violations.

Note: the booking flow is `EnhancedInlineBookingFlow` (in-page, not a `/checkout` route — direct navigation to `/book`, `/checkout`, `/booking` returns a React 404, as expected). Full end-to-end payment-step repro requires selecting a service and filling the multi-step form; signal so far is sufficient to rule out a global loader/CSP break.

### 4. No recent regression in payment loader/CSP surface
No visible edits to `index.html`, `src/lib/stripe.ts`, `SimplePaymentAuthorizationForm.tsx`, or `PaymentStep.tsx` that would touch Stripe.js loading. Recent activity has been around capture logic, worker reassignment, and admin monitoring — none of which mount the card Element.

### 5. Preview-environment caveat (important)
The Lovable **Preview** environment injects a fetch proxy (`lovable.js`) that intercepts network requests and is known to break certain Supabase auth POSTs. That can present as "the payment page never becomes usable" for staff testing on the preview URL, while the **Published** URL (`https://hero-tv-mounting.lovable.app`) works normally. If the complaint originated from someone testing the preview URL, this is the likely culprit — verify by walking checkout on the published URL. If real customers on the published site are affected, this caveat does not apply.

### 6. Mobile-specific rendering
- Stripe Elements iframe sizing is Stripe-managed; wrapping components don't set `overflow: hidden`, `pointer-events: none`, or fixed heights that would clip the iframe.
- No custom touch-event handlers on the payment-step container that could swallow taps.
- Without a specific customer device/browser + repro, a "mobile-only" bug cannot be confirmed or ruled out from static inspection alone.

## Most likely real cause

1. **Preview-URL testing:** anyone reproducing on the `id-preview--…lovable.app` URL is hitting the preview fetch proxy, not a real bug. Retest on the **published** URL.
2. **Customer abandonment** (already diagnosed): 10 stuck `payment_pending` rows match users abandoning before submitting the card. Customers phrasing this as "the site wouldn't let me enter my card" is common.
3. **Customer environment** (ad-blocker / privacy extension / corporate network blocking `js.stripe.com`, old iOS Safari). Needs a specific repro.

## Recommended next steps (choose one — nothing changed yet)

1. **Verify on the published URL** end-to-end (`https://hero-tv-mounting.lovable.app`) via Playwright: complete a booking to the payment step, confirm the Stripe iframe mounts and accepts input.
2. **Get one concrete repro** from the escalated customer: device, browser + version, screenshot, and which step failed.
3. **Instrument `PaymentStep`** (small, low-risk edit): log to an edge function whether `stripe`/`elements` ever resolved, so future incidents produce a clear signal instead of ambiguity.
4. **Add a visible loader-failure fallback** on `PaymentStep`: if `stripe`/`elements` haven't resolved in ~8s, show "Payment form failed to load — please refresh or contact support" instead of a silent spinner. Converts any future silent-load failure into a visible, reportable event.

Tell me which of (1)–(4) to run next.
