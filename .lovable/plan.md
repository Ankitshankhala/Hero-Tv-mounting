
# Why the New Stripe Key Is Still Not Working

## The Problem: Edge Functions Cache Secrets at Boot Time

You updated `STRIPE_SECRET_KEY` in the Supabase secrets dashboard — but the edge function logs still show the **old invalid `mk_1T2D4...` key**. This is expected Supabase behavior:

- When a secret is updated in the dashboard, **already-running (warm) edge function instances keep the old value in memory**
- The new secret is only picked up when a function does a **cold boot** (i.e., is redeployed or the instance expires naturally)
- The logs confirm the `payment-engine` booted at 16:07:24 UTC — **before** your key update — and it still had the old key cached

You do not need to change any code. You only need to **redeploy** the affected edge functions so they cold-boot with the new key.

---

## Which Edge Functions Use STRIPE_SECRET_KEY

From the codebase search, 7 functions read this secret directly:

| Function | Purpose |
|---|---|
| `payment-engine` | Primary — all authorize/capture/refund ops |
| `admin-process-refund` | Admin-triggered refunds |
| `stripe-transactions-sync` | Sync Stripe charges to DB |
| `sync-stripe-captures` | Sync captured payment intents |
| `unified-payment-verification` | Verify PaymentIntent status |
| `cleanup-pending-bookings` | Cancels expired Stripe authorizations |
| `bulk-delete-payment-pending` | Bulk cancel/void pending bookings |

Plus the shared helper `_shared/stripe.ts` which is imported by `payment-engine` and others.

The most critical one is `payment-engine` — it is the single function that all payment authorizations flow through.

---

## The Fix: Redeploy All Stripe-Using Edge Functions

Redeploying forces a fresh cold boot, which makes each function read the new `STRIPE_SECRET_KEY` from the secrets store.

Functions to redeploy (in priority order):
1. `payment-engine` — most critical, fixes the 400 error immediately
2. `admin-process-refund`
3. `stripe-transactions-sync`
4. `sync-stripe-captures`
5. `unified-payment-verification`
6. `cleanup-pending-bookings`
7. `bulk-delete-payment-pending`

No code changes are needed. This is purely a redeployment to flush the cached secret.

---

## What Will Happen After Redeploy

Once `payment-engine` is redeployed with the valid `sk_test_` or `sk_live_` key:

1. The `StripeAuthenticationError` will stop
2. Payment authorizations from the customer booking flow will succeed
3. The 400 error chain (`payment-engine` → `unified-payment-authorization` → frontend) will be resolved
4. The booking at `b3fc028e-f05c-4e93-ad1e-bc37cb0853fb` can be retried immediately
