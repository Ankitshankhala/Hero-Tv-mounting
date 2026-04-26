# Stripe Test/Live Mode Toggle — DONE

## What this does
Admins can flip the entire app between Stripe **Test** and **Live** modes from the admin Payments tab — no `.env` edits, no redeploy.

## How it works

1. **Database**: `app_settings` table with a `stripe_mode` row (`live` | `test`). Admin-only writes via RLS, public reads.
2. **Frontend** (`src/lib/stripe.ts`): hydrates the mode from DB on app boot (in `main.tsx`), subscribes to realtime so any open tab updates instantly when an admin flips the switch.
3. **Backend** (`supabase/functions/_shared/stripe.ts`): each Stripe-using edge function calls `await refreshStripeMode()` at the top of its handler, which caches the DB value for 30s and selects the matching `STRIPE_SECRET_KEY` / `STRIPE_SECRET_KEY_TEST`.
4. **Admin UI**: `StripeModeToggle` card at the top of the Payments tab — switch with confirmation dialog. Mode badge in `AdminHeader` updates live.

## Required Supabase secrets
Both must be present for the toggle to work in either direction:
- `STRIPE_SECRET_KEY` (sk_live_…)
- `STRIPE_SECRET_KEY_TEST` (sk_test_…)

## Required `.env` (frontend)
- `VITE_STRIPE_PUBLISHABLE_KEY="pk_live_…"`
- `VITE_STRIPE_PUBLISHABLE_KEY_TEST="pk_test_…"`

## Notes
- Default is `live` — never accidentally test.
- Customers mid-checkout when an admin flips the toggle may need to retry (key mismatch on already-loaded Stripe.js instance).
- Audit trail in `app_settings_audit` records every mode change (who / when / old → new).
