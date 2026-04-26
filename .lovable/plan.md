# Unified Worker "Complete Job & Accept Payment" Flow

## Goal

Replace today's split 2-step flow (frontend marks `status=completed` → then calls capture) with a single atomic server-side action: **one button → one edge function → capture-then-complete-then-archive**. No worker UI ever mutates booking status. Jobs cannot enter `status=completed` unless Stripe capture succeeded.

## Current problems (verified in code)

- `src/components/worker/JobActions.tsx` (lines 61–115) updates `bookings.status='completed'` first, then calls `capture-payment-intent`. If capture fails the booking is left `completed + authorized` and the worker dashboard hides it (active list excludes `status==='completed'`).
- Two separate "Charge" buttons exist (`JobActions` Mark Complete + `worker/PaymentCaptureButton`), with contradictory visibility rules — workers don't know which to click.
- `WorkerDashboardWithSidebar.tsx` calls a non-existent function `capture-payment` (line 205) — silently fails.
- `add-booking-services` auto-captures and completes the job after adding services (lines 104–125 in `supabase/functions/add-booking-services/index.ts`). This contradicts the rule "capture only via the worker's complete button."
- `worker/PaymentCaptureButton.tsx` treats `bookingStatus==='completed'` as "Payment Captured" — wrong; a completed booking can still be unpaid today.

## Plan

### 1. Backend: add atomic action `complete-and-capture` to `payment-engine`

In `supabase/functions/payment-engine/index.ts`, add a new action alongside the existing `capture` action:

- Validate auth + worker/admin owns booking.
- Load booking; if `payment_status` already `captured`/`completed` → idempotently set `status='completed'`, archive, return success.
- Reject if `status` not in (`confirmed`, `in_progress`, `payment_authorized`) or `payment_status !== 'authorized'` or no `payment_intent_id` or `requires_manual_payment=true`.
- Recalculate expected total from `booking_services` + `tip_amount`.
- Retrieve PI from Stripe.
  - If `pi.status === 'succeeded'` (Stripe already captured, DB out of sync) → finalize DB and return `recovered_from_stripe: true`.
  - If `pi.status !== 'requires_capture'` → throw clear error.
  - If amount mismatch >1¢ → throw "Booking total changed, please recalculate first".
- Capture with `idempotencyKey: complete_capture_${bookingId}_v${payment_version}`.
- Only after Stripe `succeeded`: in one DB pass set `status='completed'`, `payment_status='captured'`, `captured_amount`, `pending_payment_amount=null`, `is_archived=true`, `archived_at=now()`. Update/insert transaction row. Insert `booking_audit_log` row. Fire-and-forget invoice generation.

Keep the existing `capture` action for admin/legacy callers but it will no longer be the worker path.

### 2. Backend: thin wrapper edge function `worker-complete-and-capture`

New function `supabase/functions/worker-complete-and-capture/index.ts` that just forwards `{ booking_id }` to `payment-engine` action `complete-and-capture` with the caller's Authorization header. This gives the frontend a single, clearly-named endpoint.

### 3. Backend: stop auto-capturing in `add-booking-services`

In `supabase/functions/add-booking-services/index.ts`:
- Remove the atomic capture block (lines ~104–125).
- Keep `recalculate` / `charge-difference` (so authorization stays in sync).
- Job stays active; capture happens only when worker clicks the unified button.

Update `AddServicesModal` button label from "Charge Full Amount & Complete Job" to "Add Services to Job".

### 4. Frontend: unify worker action in `JobActions.tsx`

- Remove `handleMarkComplete`'s frontend status update + capture chain.
- Remove the "Charge" Mark-Complete button and the second `<PaymentCaptureButton>` charge button.
- Add a single button **"Complete Job & Accept Payment"** shown when:  
  `status ∈ {confirmed, in_progress, payment_authorized}` AND `payment_status === 'authorized'` AND `payment_intent_id` AND `!requires_manual_payment`.
- On click → `supabase.functions.invoke('worker-complete-and-capture', { body: { booking_id: job.id } })`. Toast success/failure; refresh on success only.
- Keep `Archive Job` button for already-captured jobs.
- Keep `Collect Payment` (re-auth) button for `failed`/`cancelled` payment_status — that's a separate recovery path.

### 5. Retire worker-side `PaymentCaptureButton` from job cards

- Remove its usage in `JobActions.tsx`.
- Leave `src/components/admin/PaymentCaptureButton.tsx` (admin recovery) untouched.
- Worker-side `src/components/worker/PaymentCaptureButton.tsx` becomes unused → delete (or keep only for an explicit admin recovery surface).

### 6. Fix `WorkerDashboardWithSidebar.tsx`

- Remove the broken `capture-payment` invocation in `updateJobStatus` (line 205).
- The status dropdown should not allow workers to push to `completed` directly. Either remove the "completed" option from `getValidNextStatuses` or route any "complete" intent through the new `worker-complete-and-capture` function.

### 7. Database safety guard (migration)

Add/strengthen a trigger so a booking transition into `status='completed'` requires `payment_status IN ('captured','completed')`. This way, even if any legacy code path tries the old "complete-then-capture" pattern, Postgres rejects it. Continue to allow the legacy `'completed'` payment_status string for old rows; new writes use `'captured'`.

### 8. Recovery alignment

`sync-stripe-captures` already sets `payment_status='captured'` for Stripe-succeeded PIs. Extend its update to also set `status='completed'`, `is_archived=true`, `archived_at=now()`, `captured_amount` so out-of-sync bookings are fully repaired. `detect-uncaptured-payments` continues to alert admin for stuck authorizations.

## Final worker UX

Active job card buttons: Call Customer · Open Map · Add Services · Remove Services · Reassign · Change Time · **Complete Job & Accept Payment**.

Click → backend captures Stripe → DB atomically marks completed + captured + archived → invoice queued → toast "Payment captured: $X". On failure → job stays active, clear error toast, no DB mutation.

## Files touched

Backend:
- `supabase/functions/payment-engine/index.ts` — new `complete-and-capture` action.
- `supabase/functions/worker-complete-and-capture/index.ts` — new wrapper.
- `supabase/functions/add-booking-services/index.ts` — remove auto-capture block.
- `supabase/functions/sync-stripe-captures/index.ts` — also complete+archive on recovery.
- New migration — trigger requiring captured payment for `status='completed'`.

Frontend:
- `src/components/worker/JobActions.tsx` — single button, single backend call.
- `src/components/worker/AddServicesModal.tsx` — relabel button, no capture expectation.
- `src/components/worker/PaymentCaptureButton.tsx` — remove usage (delete file).
- `src/pages/WorkerDashboardWithSidebar.tsx` — remove broken `capture-payment` call.

## Out of scope

- Re-auth / `Collect Payment` flow for failed/cancelled cards (kept as is).
- Admin `PaymentCaptureButton` (kept for admin recovery view).
- Tip collection UI changes.
