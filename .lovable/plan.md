

# Correct Stripe Reauth Flow: Cancel Old PI, Create New PI

## What Already Works

The `worker-remove-services` edge function (lines 347-384) already implements this exact pattern for service removals. The `add-booking-services` edge function also has it (lines 87-142). Both follow the cancel-old/create-new flow correctly.

## What's Broken

Two problems prevent this flow from working:

1. **`unified-payment-authorization` never saves `stripe_customer_id` or `stripe_payment_method_id`** -- so the reauth check `hasPaymentMethod = booking.stripe_customer_id && booking.stripe_payment_method_id` always returns false.

2. **`EnhancedInvoiceModificationModal.addNewService()` (line 325) does a direct DB insert** instead of calling `add-booking-services`, completely bypassing Stripe. Same for `updateServiceQuantity()` (line 223) and `handleSubmitModification()` (line 377) which calls a non-existent edge function `process-invoice-modification-payment`.

## Changes

### 1. `supabase/functions/unified-payment-authorization/index.ts`

Save Stripe customer and payment method during initial checkout so the reauth flow has what it needs.

**Before PaymentIntent creation (after line 79):**
- Look up existing Stripe customer by email, or create one
- Attach `paymentMethodId` to that customer
- Pass `customer: stripeCustomerId` into `stripe.paymentIntents.create()`

**In the booking update (line 132-136):**
- Add `stripe_customer_id: stripeCustomerId`
- Add `stripe_payment_method_id: paymentMethodId`

**Move booking update out of `EdgeRuntime.waitUntil`** -- the `payment_intent_id` write must be synchronous (per existing memory on payment-intent-integrity race conditions). Keep only non-critical writes (audit log, invoice generation) in the background.

### 2. `supabase/functions/sync-payment-after-modification/index.ts` (NEW)

A focused edge function that implements the user's exact specified flow:

```
Input: { booking_id }

1. Fetch booking (with stripe_customer_id, stripe_payment_method_id, payment_intent_id)
2. Fetch all booking_services, calculate server-side total
3. Add tip_amount from booking
4. Retrieve current PaymentIntent from Stripe
5. Compare amounts:
   - If equal: return no-op
   - If PI status is requires_capture AND amount changed:
     a. Cancel old PI
     b. Create new PI with:
        - same customer
        - same payment method  
        - capture_method: 'manual'
        - confirm: true
        - off_session: true
     c. Update booking.payment_intent_id (synchronous)
     d. Update transactions table
     e. Log to booking_audit_log
   - If PI status is succeeded (already captured):
     - Increase: create separate charge for difference
     - Decrease: issue partial refund
   - If no saved payment method: return { requires_manual_payment: true }
6. Return result with new_payment_intent_id
```

Idempotency key: `sync_${booking_id}_${new_amount_cents}` on all Stripe calls.

### 3. `src/components/worker/EnhancedInvoiceModificationModal.tsx`

**`addNewService()` (line 325):** Replace direct DB insert with call to `add-booking-services` edge function (which already has the cancel/create-new-PI logic).

**`updateServiceQuantity()` (line 223):** After the DB update succeeds, call `sync-payment-after-modification` to sync the Stripe PI amount.

**`handleSubmitModification()` (line 377):** Replace the call to non-existent `process-invoice-modification-payment` with `sync-payment-after-modification`. Remove manual `pending_payment_amount` calculation since the edge function handles it server-side.

### 4. `supabase/functions/capture-payment-intent/index.ts`

Add a pre-capture safety net (before line 120): compare `captureAmountCents` against DB services total. If they differ, call `sync-payment-after-modification` first to get the correct PI, then proceed with capture on the updated PI.

### 5. `supabase/config.toml`

Add:
```toml
[functions.sync-payment-after-modification]
verify_jwt = false
```

## Flow Diagram

```text
Worker modifies services
       |
       v
addNewService() ──> add-booking-services edge fn ──> cancel old PI, create new PI
updateQuantity() ──> DB update ──> sync-payment-after-modification ──> cancel old PI, create new PI
removeService() ──> worker-remove-services edge fn ──> cancel old PI, create new PI (already works)
submitAll() ──> sync-payment-after-modification ──> cancel old PI, create new PI
       |
       v
All paths: booking.payment_intent_id updated to new PI
       |
       v
capture-payment-intent ──> safety check ──> captures correct amount
```

## Files Summary

| File | Action | What Changes |
|------|--------|-------------|
| `supabase/functions/unified-payment-authorization/index.ts` | MODIFY | Save stripe_customer_id + stripe_payment_method_id, move booking update out of waitUntil |
| `supabase/functions/sync-payment-after-modification/index.ts` | CREATE | Cancel old PI, create new PI with saved payment method |
| `src/components/worker/EnhancedInvoiceModificationModal.tsx` | MODIFY | Route all modifications through edge functions with Stripe sync |
| `supabase/functions/capture-payment-intent/index.ts` | MODIFY | Pre-capture amount validation safety net |
| `supabase/config.toml` | MODIFY | Add sync function config |

