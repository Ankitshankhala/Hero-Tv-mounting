

# Fix: Worker Reassign Job Black Screen

## Root Cause Analysis

There are **two distinct bugs** causing problems:

### Bug 1: Black Screen Crash (UI)

In `ReassignJobModal.tsx` line 150, when no eligible workers are found:

```tsx
<SelectItem value="" disabled>
  No eligible workers found
</SelectItem>
```

**Radix UI Select crashes when a `SelectItem` has an empty string `value=""`**. This is a known Radix UI bug -- it throws an unrecoverable React render error, which kills the entire component tree and produces a black/white screen. There is no error boundary wrapping this modal, so the crash propagates to the entire page.

### Bug 2: No Payment Authorization Check (Backend)

The `worker-reassign-booking` edge function reassigns bookings without checking the payment authorization status. Stripe payment authorizations expire after **7 days**. If a worker tries to reassign a booking where the authorization has expired, the reassignment succeeds in the database but the new worker inherits a booking with a dead payment -- they cannot capture payment later, causing financial issues.

---

## The Fix

### File 1: `src/components/worker/ReassignJobModal.tsx`

**Change A - Fix the crash on empty worker list:**
- Replace the `SelectItem value=""` with a plain `<div>` message inside `SelectContent` when no workers are found
- Radix Select only crashes when `SelectItem` has invalid/empty values

**Change B - Add error boundary safety:**
- Wrap the entire `handleReassign` function in proper try/catch (already exists but needs tightening)
- Add `DialogDescription` for accessibility (missing, causes console warning)

**Change C - Show payment authorization warning:**
- After fetching the booking in the eligible-workers call, check if payment authorization might be expired (booking created more than 7 days ago with `payment_status === 'authorized'`)
- Show a warning banner in the modal: "Payment authorization may have expired for this booking. The new worker may need to collect payment manually."

### File 2: `supabase/functions/worker-reassign-booking/index.ts`

**Change A - Add payment authorization expiry check:**
- After fetching the booking (line 73), check if the booking has `payment_status === 'authorized'` and the authorization is older than 7 days
- If expired, set `requires_manual_payment = true` on the booking after reassignment so the new worker and admin know
- Add the expiry status to the audit log details
- Return `paymentExpired: true` in the response so the UI can inform the worker

**Change B - Fix the `sms_logs` insert in the error handler (line 185-191):**
- The `sms_logs` table has a `status` column of type `USER-DEFINED` (enum), and `'failed'` may need to match the enum exactly
- Also, `emailError.message` on line 190 might be undefined if `emailError` is not an Error instance -- guard with optional chaining

### File 3: `src/components/worker/JobActions.tsx`

**No changes needed.** The modal is already wrapped in state-controlled rendering. The crash comes from inside the modal's Radix Select component, which is fixed in File 1.

---

## Technical Details

### SelectItem Fix (File 1, line 148-159)

```text
BEFORE:
  {workers.length === 0 && !fetchingWorkers ? (
    <SelectItem value="" disabled>
      No eligible workers found
    </SelectItem>
  ) : ( ... )}

AFTER:
  {workers.length === 0 && !fetchingWorkers ? (
    <div className="py-2 px-3 text-sm text-muted-foreground">
      No eligible workers found
    </div>
  ) : ( ... )}
```

### Payment Expiry Check (File 2, after line 91)

```text
Add after booking status validation:

  // Check payment authorization expiry (7-day window)
  const authCreatedAt = new Date(booking.created_at);
  const now = new Date();
  const daysSinceAuth = (now.getTime() - authCreatedAt.getTime()) / (1000 * 60 * 60 * 24);
  const paymentExpired = booking.payment_status === 'authorized' && daysSinceAuth > 7;

  // If payment is expired, flag the booking for manual payment
  if (paymentExpired) {
    updateFields.requires_manual_payment = true;
  }
```

### Response Enhancement (File 2, line 195-202)

```text
Add paymentExpired flag to the success response so the UI can display
an appropriate warning to the worker about needing manual payment collection.
```

### Modal Warning (File 1)

```text
When the reassignment response returns paymentExpired: true, show a toast warning:
"Booking reassigned, but payment authorization has expired. 
 The new worker will need to collect payment manually."
```

---

## What This Fixes

| Problem | Before | After |
|---|---|---|
| Black screen on reassign | Radix Select crashes on empty value | Uses plain div for empty state |
| Expired payment auth | Silently reassigns with dead payment | Flags booking and warns worker |
| Console accessibility warning | Missing DialogDescription | Added |
| sms_logs error logging | Could fail on undefined message | Properly guarded |

## Files to Change

| File | Change |
|---|---|
| `src/components/worker/ReassignJobModal.tsx` | Fix SelectItem crash, add DialogDescription, show payment expiry warning |
| `supabase/functions/worker-reassign-booking/index.ts` | Add 7-day payment auth check, flag `requires_manual_payment`, fix sms_logs error handler |

