# Stripe Test/Live Mode Toggle

## Goal
Stop hand-editing Stripe keys. Add a single `STRIPE_MODE` switch (`test` or `live`) that controls which keys the frontend and all edge functions use. Flipping one value swaps the entire app between Stripe Test and Live.

## How it will work (for non-technical users)

- You'll have **both** sets of Stripe keys configured at the same time (test + live).
- Switching modes = changing one value (`STRIPE_MODE`) in `.env` and in Supabase secrets.
- A small **"STRIPE: TEST"** or **"STRIPE: LIVE"** badge will show in the admin dashboard so the current mode is always obvious.
- Default mode stays **live** so production isn't accidentally affected.

---

## Changes

### 1. Frontend — single source of truth

**`.env`** — add test key + mode flag:
```
VITE_STRIPE_PUBLISHABLE_KEY="pk_live_..."          (existing)
VITE_STRIPE_PUBLISHABLE_KEY_TEST="pk_test_..."     (new — you provide)
VITE_STRIPE_MODE="live"                             (new — flip to "test")
```

**`src/lib/stripe.ts`** — refactor:
- Remove the hardcoded `pk_live_...` constant.
- Read `VITE_STRIPE_MODE` and return the matching key from `.env`.
- Export a `STRIPE_MODE` constant for UI display.

All four existing consumers (`StripeCardElement`, `StripeConfigTest`, `ReauthorizePaymentDialog`, `useStripePayment`) keep working unchanged — they import the same `STRIPE_PUBLISHABLE_KEY` symbol.

### 2. Backend — centralize key selection

**`supabase/functions/_shared/stripe.ts`** — make this the only place that picks a key:
- Read `STRIPE_MODE` secret (default `"live"`).
- Return either `STRIPE_SECRET_KEY` or `STRIPE_SECRET_KEY_TEST`.
- Export both `createStripeClient()` (Stripe SDK) and `getStripeSecretKey()` (raw key for `fetch` calls).

**Refactor 13 edge functions** to use the shared helper instead of reading `STRIPE_SECRET_KEY` directly:
- `admin-process-refund`, `async-payment-sync`, `bulk-delete-payment-pending`, `cancel-payment-intent`, `cleanup-pending-bookings`, `create-payment-intent`, `get-payment-method-details`, `payment-engine`, `setup-customer-payment`, `stripe-transactions-sync`, `sync-stripe-captures`, `unified-payment-verification`, `worker-remove-services`

After this, switching the entire backend = flipping one secret.

### 3. Supabase secrets (you add manually)

Add two new secrets in **Supabase Dashboard → Edge Functions → Secrets**:
- `STRIPE_SECRET_KEY_TEST` = your `sk_test_...` key
- `STRIPE_MODE` = `live` (default) — change to `test` when testing

Existing `STRIPE_SECRET_KEY` (live) stays as-is.

### 4. Admin visibility

Add a small mode badge to the admin dashboard header (`src/pages/AdminDashboard.tsx` or similar):
- Reads `STRIPE_MODE` from `src/lib/stripe.ts`.
- Shows green **"STRIPE: LIVE"** or amber **"STRIPE: TEST"** pill.
- Prevents the "wait, am I in test mode?" confusion.

Update existing `StripeConfigStatus.tsx` and `LivePaymentValidator.tsx` to use the new constant instead of reading `import.meta.env` directly.

---

## How you'll switch modes after this is built

**To test:**
1. `.env` → set `VITE_STRIPE_MODE="test"`
2. Supabase secrets → set `STRIPE_MODE` to `test`
3. Edge functions auto-redeploy

**To go back to live:**
1. `.env` → set `VITE_STRIPE_MODE="live"`
2. Supabase secrets → set `STRIPE_MODE` to `live`

No code edits, no key copy-pasting, no risk of leaving the wrong key in production.

---

## What I'll need from you before implementing

1. Your **`pk_test_...`** publishable key (safe to put in `.env`, you can paste it in chat).
2. Your **`sk_test_...`** secret key — you'll add it as a Supabase secret named `STRIPE_SECRET_KEY_TEST` (don't paste it in chat).

## Out of scope (deliberately)

- A UI-driven runtime toggle (Option 2). Heavier, riskier — can be added later if you actually need to flip without redeploying.
- Webhook secret toggling — not currently used in the codebase.
- Migrating to Lovable's built-in Stripe payments.
