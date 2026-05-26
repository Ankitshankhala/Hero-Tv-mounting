## Surface exact failure reasons in the Admin panel

Right now when an admin action fails (delete worker, update booking, etc.) the toast just says `"Failed to ..."` and the real Postgres / RLS / FK / trigger error is only visible in the browser console. I'll make the admin panel show the **exact** reason in the UI.

### What I'll change

1. **Shared admin error formatter** — new `src/utils/adminErrorMessage.ts` that takes any Supabase error and returns a precise human message, using the actual `code`, `message`, `details`, and `hint`:
   - `23503` → "Cannot delete: still referenced by N row(s) in `<table>` (FK `<constraint>`). Archive instead."
   - `23505` → "Duplicate value for `<column>`."
   - `42501` / RLS → "Blocked by Row Level Security: your admin role can't `<op>` this row. Policy: `<policy if available>`."
   - `P0001` (RAISE EXCEPTION from triggers) → show the trigger's own message verbatim (e.g. `validate_booking_has_coverage: Invalid or missing ZIP code`).
   - `PGRST301` / JWT errors → "Session expired, please sign in again."
   - Network / 5xx → "Supabase request failed: `<status> <statusText>`."
   - Unknown → fall back to `error.message` + `error.details` (never a generic string).

2. **Wire it into admin actions** — replace the generic toasts in:
   - `src/components/admin/WorkerTable.tsx` (`handleRemoveWorker`, `handleReactivateWorker`, `handlePermanentlyDeleteWorker`)
   - `src/components/admin/WorkersManager.tsx` (fetch errors)
   - `src/components/admin/worker-table/WorkerActionsDropdown.tsx` (SMS / actions)
   - other admin mutation surfaces that today say `"Failed to …"` (WorkerApplicationsManager, AdminWorkerCoverageModal, coupon manager, services manager, invoice/booking admin actions) — covered with a single grep pass and the same helper

3. **Persistent details, not just a toast** — toasts auto-dismiss. For destructive failures the message will also be:
   - logged to `console.error` with the full error object (already done), and
   - shown in an inline `<Alert variant="destructive">` under the table row / modal so the admin can read and copy it.

4. **Verify in preview** — trigger an intentional failure (e.g. try to hard-delete a worker that still has bookings) and confirm the toast now reads e.g. `FK violation: bookings.worker_id still references this user (43 rows). Archive instead of deleting.`

### What I won't touch

- No RLS / policy / trigger changes.
- No schema or FK changes.
- No business logic in booking / payment / payroll flows.
- Frontend / presentation only.

### Out of scope (ask if you want this too)

- Building a project-wide "Admin error log" page that records every failed admin action to a new table. Let me know if you want that — it requires a new table + RLS + a hook.
