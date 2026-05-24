## Problem

Admin cannot reassign a job to a different worker. Today:
- `AssignWorkerModal` only queries `bookings` where `worker_id IS NULL`, so already-assigned jobs are invisible.
- `EditBookingModal` displays "✓ Worker Assigned · Worker ID: …" as a read-only block with no change/reassign action.

Result: once a worker is assigned (or auto-assigned), the admin is locked out of moving the job — they can only edit date/time/notes.

## Fix

Add a Reassign Worker control inside `EditBookingModal` that lets admin swap the worker on any assigned booking, with availability validation and notifications. Also expose the same action as a row-level button in `BookingTable`.

### Changes

1. **`src/components/admin/EditBookingModal.tsx`** — replace the read-only "✓ Worker Assigned" block with an editable section:
   - Show current worker (name, email, phone) instead of raw UUID.
   - Add a "Change Worker" button that swaps the block into a worker `Select` populated with active workers.
   - Run `supabase.rpc('validate_worker_booking_assignment', { p_worker_id, p_booking_date, p_booking_time, p_duration_minutes: 60 })` against the booking's (possibly newly edited) date/time before saving; disable Save and show inline error if invalid.
   - On Save (when worker changed):
     - `UPDATE bookings SET worker_id = newWorkerId, status = 'confirmed' WHERE id = booking.id`
     - Upsert into `worker_bookings` for the new worker; mark old `worker_bookings` row as `reassigned`/delete (match existing patterns in `AssignWorkerModal`).
     - Fire `unified-email-dispatcher` for new worker (`worker_assignment`), previous worker (`worker_unassignment` if template exists, otherwise skip with console warning), and customer (`customer_booking_confirmation`).
     - Insert a row into `booking_audit_log` with `operation='worker_reassigned'`, details: `{ from_worker_id, to_worker_id, reason }`.
   - Add an optional "Reason" text field shown only when changing worker.

2. **`src/components/admin/BookingTable.tsx`** — add a "Reassign" icon button (UserCog) in the actions cell for any booking that has a `worker_id` and is not archived/completed. Clicking it opens `EditBookingModal` pre-scrolled / pre-expanded to the Worker section. (Implementation: pass `initialFocus="worker"` prop to the modal which auto-opens the change-worker selector.)

3. **`src/components/admin/AssignWorkerModal.tsx`** — small relaxation: keep current filter for the "Assign" entry point, but accept a `mode: 'assign' | 'reassign'` prop. When `reassign`, fetch the single booking by id even if `worker_id IS NOT NULL`. This lets the existing modal be reused if preferred over inline editing in step 1. (Optional — only ship if reviewer prefers a dedicated modal over inline.)

### Reuses existing infra

- `validate_worker_booking_assignment` RPC for conflict detection.
- `unified-email-dispatcher` edge function for notifications.
- `booking_audit_log` table for audit trail (admin RLS already allows SELECT; service role inserts).
- Admin RLS on `bookings` (`Admin full access to bookings`) permits the update.

### Out of scope

- No backend/RLS changes.
- No changes to auto-assignment logic.
- No changes to customer-facing rescheduling flows.
- No SMS rewrite — emails only (SMS already triggers from existing booking-update side effects).

### Verification

1. Admin opens any booking with an assigned worker → EditBookingModal now shows worker name + "Change Worker" button.
2. Click Change Worker → dropdown of active workers; selecting an unavailable one (conflicting schedule) shows the validation error and disables Save.
3. Selecting a valid worker + Save → booking.worker_id updates; new worker receives assignment email; customer receives confirmation with updated worker; audit log row created.
4. Date/time can be changed in the same submit — validation re-runs against the new slot.
5. Reassign button in BookingTable opens the same modal already focused on worker change.
