

# Remove Services Payment Flow — Implementation Plan

## Fix A: Remove completed status guard
**File:** `worker-remove-services/index.ts` line 75
- Delete `if (booking.status === 'completed') throw new Error("Cannot remove services from completed bookings");`
- The payment-engine already branches correctly on `payment_status`

## Fix B: Surface payment failure in edge function
**File:** `worker-remove-services/index.ts` lines 163-237
- Add a `paymentAdjustmentFailed` boolean flag, set to `true` when payment-engine errors or returns null while `refundAmount > 0`
- Include `payment_adjustment_failed` in the response data object
- No change to try/catch structure — just track and surface the failure

## Fix C: Frontend safety check
**File:** `RemoveServicesModal.tsx` lines 170-199
- After `if (!data.success)` check, before the reauth check, add:
  - If `data.data?.payment_adjustment_failed === true`, show destructive toast "Services removed but payment was not adjusted. Contact admin.", call `onModificationCreated()` to refresh, and return early

## Fix D: Zero-total guard
**File:** `worker-remove-services/index.ts`, after service deletion (line 110) and before payment-engine delegation (line 163)
- Import Stripe client from `_shared/stripe.ts`
- Calculate remaining services total from DB after deletion
- If remaining total is `0` AND `booking.payment_status === 'authorized'` AND `booking.payment_intent_id`:
  - Cancel the PI via Stripe
  - Update booking: `payment_status: 'cancelled'`, `requires_manual_payment: true`, `payment_intent_id: null`
  - Return early with `{ success: true, requires_manual_payment: true }`

## Technical Details

### Edge function changes (worker-remove-services/index.ts):
1. Add Stripe import at top
2. Line 75: delete the completed guard
3. After line 161 (modification records insert), before payment delegation: add zero-total guard block
4. Lines 163-234: add `paymentAdjustmentFailed` tracking flag, set it on error/null result, include in response

### Frontend changes (RemoveServicesModal.tsx):
1. After line 173 (`if (!data.success)` block): add payment_adjustment_failed check with destructive toast and early return

### Edge cases noted:
- The "cannot remove all services" guard (line 93) still allows removing down to one $0-price service — the zero-total guard (Fix D) handles this
- Fix D uses direct Stripe call (cancel only) since payment-engine doesn't have a "cancel" action for zero-total scenarios

