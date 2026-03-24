

# Fix Add Services Payment Flow — Implementation Plan

## Summary
Six fixes addressing critical payment flow failures, ordered by severity.

---

## Fix 1: Unlock Stuck Bookings (CRITICAL)
**File:** `src/components/worker/AddServicesModal.tsx` line 130

**Before:**
```typescript
if (job.payment_status === 'captured' || job.status === 'completed') {
  toast({ description: "This booking has already been charged..." });
```

**After:**
```typescript
if (job.payment_status === 'captured') {
  toast({ description: "This booking's payment has already been captured. Please create a new booking for additional services." });
```

Only block when payment is actually captured. Completed-but-authorized bookings remain accessible.

---

## Fix 2: Create-Before-Cancel in Payment Engine (CRITICAL)
**File:** `supabase/functions/payment-engine/index.ts` lines 272-335 (recalculate, pre-capture branch)

Flip the order from cancel→create→update to create→update→cancel:

1. Create new PI first (if fails, old PI remains safe)
2. Update booking DB with new PI ID
3. Cancel old PI (if fails, log warning but don't throw — old PI expires naturally)

This eliminates the window where both PIs are gone.

---

## Fix 3: Atomic Server-Side Capture (HIGH)
**File:** `supabase/functions/add-booking-services/index.ts`

After payment-engine `recalculate` succeeds (and action was recalculate, not charge-difference), immediately invoke payment-engine `capture` within the same edge function. Return `amount_captured` in the response.

**File:** `src/components/worker/AddServicesModal.tsx` lines 216-283

Remove the separate frontend capture call. After `add-booking-services` returns success:
- If response includes `amount_captured` → proceed to mark completed + archived
- If response has no `amount_captured` and `new_amount > 0` → show hard error (Fix 4)

The frontend flow becomes: one edge function call → status update → archive.

---

## Fix 4: Null PI Gate Protection (MEDIUM)
**File:** `src/components/worker/AddServicesModal.tsx`

After removing the separate capture call (Fix 3), add a check: if `add-booking-services` returns `success: true` but no `amount_captured` and `new_amount > 0`, show a destructive toast: "Services added but payment was not captured. Contact admin." Do NOT mark as completed.

---

## Fix 5: Reset Meagan Young's Booking (DATA)
Run SQL via insert tool:
```sql
UPDATE bookings 
SET status = 'confirmed'
WHERE id = '1a327b1f-9973-4df9-8283-3149a430d937'
  AND payment_status = 'authorized'
  AND status = 'completed'
  AND captured_amount IS NULL;
```

First verify with a SELECT to confirm the booking exists in this state.

---

## Fix 6: Uncaptured PI Monitoring (MONITORING)
Create a new edge function `detect-uncaptured-payments` that:
1. Queries bookings where `payment_status = 'authorized'`, `status IN ('completed','confirmed')`, `scheduled_date < NOW() - INTERVAL '1 day'`, `captured_amount IS NULL`
2. For each result, inserts an `admin_alert` with severity `high`
3. Optionally sends SMS/email via existing notification infrastructure

Schedule via pg_cron to run daily.

---

## Files Changed Summary

| File | Change |
|---|---|
| `src/components/worker/AddServicesModal.tsx` | Fix guard (line 130), remove capture call (lines 216-283), add safety check |
| `supabase/functions/payment-engine/index.ts` | Flip recalculate to create-before-cancel (lines 272-335) |
| `supabase/functions/add-booking-services/index.ts` | Add capture invocation after recalculate succeeds |
| `supabase/functions/detect-uncaptured-payments/index.ts` | New monitoring function |
| SQL (insert tool) | Reset Meagan Young booking, schedule pg_cron job |

