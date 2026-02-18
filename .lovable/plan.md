
# Root Cause: Stale Stripe Customer IDs After Key Change

## What Is Happening

The Stripe API key was changed (from the invalid `mk_` prefix key to a valid one). However, the new key is connected to a **different Stripe account or mode** than before. The `stripe_customers` table in the database still holds customer IDs (like `cus_Tyx1zsQPbk3h07`) that were created under the **old** Stripe account. Stripe returns a 404 "No such customer" error because those IDs do not exist in the current account, causing the payment engine to throw a 400 error.

The flow breaks here in `payment-engine`:
```
1. Booking submitted with customerEmail = "charusolutions@gmail.com"
2. payment-engine looks up stripe_customers table → finds cus_Tyx1zsQPbk3h07
3. Tries to attach paymentMethod to cus_Tyx1zsQPbk3h07 in Stripe
4. Stripe: "No such customer" (ID belongs to old account/mode)
5. payment-engine throws → 400 returned to frontend
```

## Two-Part Fix

### Part 1: Clear Stale Customer Records (Database)
Delete all rows from the `stripe_customers` table so the payment engine can create fresh customers in the correct Stripe account. Also clear `stripe_customer_id` and `stripe_payment_method_id` from the `bookings` table (for any bookings in `payment_pending` status) and from the `users` table.

SQL to run:
```sql
-- Clear stale stripe customers
DELETE FROM stripe_customers;

-- Clear stale stripe references on pending/unprocessed bookings
UPDATE bookings
SET stripe_customer_id = NULL, stripe_payment_method_id = NULL
WHERE payment_status IN ('pending', 'payment_pending');

-- Clear stale stripe references on users table
UPDATE users
SET stripe_customer_id = NULL, stripe_default_payment_method_id = NULL, has_saved_card = FALSE;
```

### Part 2: Make payment-engine Resilient (Code)
Update the `payment-engine` authorize action to handle the case where a stored `stripe_customer_id` no longer exists in Stripe. Instead of crashing, it should:
1. Catch the `resource_missing` error from the attach/customer lookup
2. Delete the stale `stripe_customers` record
3. Create a **new** Stripe customer and continue

This makes the system self-healing for future key changes or account switches.

**In `supabase/functions/payment-engine/index.ts`**, the authorize block's customer lookup section (lines ~106–136) will be updated:

```typescript
// BEFORE (crashes on stale customer):
if (existingCustomer?.stripe_customer_id) {
  stripeCustomerId = existingCustomer.stripe_customer_id;
  try {
    await stripe.paymentMethods.attach(paymentMethodId, { customer: stripeCustomerId });
  } catch (e: any) {
    if (!e.message?.includes('already been attached')) {
      console.warn('[PAYMENT-ENGINE] attach warning:', e.message);
    }
  }
}

// AFTER (self-heals on stale/missing customer):
if (existingCustomer?.stripe_customer_id) {
  stripeCustomerId = existingCustomer.stripe_customer_id;
  try {
    // Verify customer still exists in Stripe
    await stripe.customers.retrieve(stripeCustomerId);
    await stripe.paymentMethods.attach(paymentMethodId, { customer: stripeCustomerId });
  } catch (e: any) {
    if (e.code === 'resource_missing' || e.message?.includes('No such customer')) {
      // Stale customer — delete and recreate below
      console.warn('[PAYMENT-ENGINE] Stale customer detected, recreating:', stripeCustomerId);
      await supabase.from('stripe_customers').delete().eq('email', customerEmail);
      stripeCustomerId = ''; // Fall through to creation
    } else if (!e.message?.includes('already been attached')) {
      console.warn('[PAYMENT-ENGINE] attach warning:', e.message);
    }
  }
}

if (!stripeCustomerId) {
  const customer = await stripe.customers.create({ ... });
  // ... save to stripe_customers
}
```

## Steps

1. Run the database cleanup SQL (via migration) to remove all stale `stripe_customers` rows and clear stale references on bookings/users
2. Update `payment-engine/index.ts` to handle `resource_missing` gracefully so the system self-heals if this ever happens again
3. Redeploy `payment-engine`
4. Test a new booking with a fresh card entry — the payment engine will create a new customer in the current Stripe account and authorize successfully

## Important Note on Test vs Live Mode

The publishable key in `.env` starts with `pk_live_` and the key in `src/lib/stripe.ts` also starts with `pk_live_`. Make sure the `STRIPE_SECRET_KEY` secret in Supabase is the **live** secret key (`sk_live_...`) from the **same** Stripe account, not a test key. Mixing live publishable with test secret (or vice versa) will continue to cause customer-not-found errors since customers created in test mode don't exist in live mode.
