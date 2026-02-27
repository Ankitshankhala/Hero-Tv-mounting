

# Fix: Delayed Notification on Remove Services

## Root Cause

The `RemoveServicesModal.tsx` already does an **optimistic UI update** (removes the service from the list immediately), but the **toast notification** waits for the entire edge function to finish. The `worker-remove-services` function takes 3-7 seconds because it sequentially:

1. Validates auth + fetches booking (~200ms)
2. Deletes services from DB (~100ms)
3. Updates invoice items + recalculates totals (~300ms)
4. Calls `payment-engine` recalculate which hits Stripe (cancel old PI + create new PI) (~2-5s)
5. Inserts modification records + SMS log (~200ms)

The toast only fires at line 191 **after step 5 completes**.

## Solution

Show an immediate toast right after the optimistic UI update (before `await`), then show a second toast only if payment details need reporting.

## Changes

### `src/components/worker/RemoveServicesModal.tsx`

In the `removeService` function (lines 139-215):

**Before the `await` call (after optimistic update on line 150), add:**
```typescript
// Immediate feedback
toast({
  title: "Removing Service...",
  description: `${serviceToRemove.service_name} is being removed.`,
});
```

**After the response (lines 183-194), change the toast to only show payment-related info:**
```typescript
if (data.data?.authorization_updated || data.data?.refund_amount > 0) {
  const authMsg = data.data?.authorization_updated 
    ? `Authorization updated.` : '';
  const refundMsg = data.data?.refund_amount > 0 
    ? `Refund of $${data.data.refund_amount.toFixed(2)} processed.` : '';
  toast({
    title: "Payment Updated",
    description: `${authMsg} ${refundMsg}`.trim(),
  });
}
```

This gives the worker instant visual feedback (within ~50ms) while the backend processes payment operations in the background.

### No backend changes needed

The edge function logic and sequencing remain the same -- this is purely a frontend UX improvement.

