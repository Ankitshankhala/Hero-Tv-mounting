## Problem

Clicking **Remove Worker** in the admin panel works at the database level (soft-sets `is_active=false`), but the worker keeps appearing in the technicians table. The list never filters by `is_active`, so admins perceive the action as broken.

This is confirmed by the data: two soft-removed workers (`Joseph Dickson`, `ANKIT SHANKHALA`) already have `is_active=false` in the DB but still render in the Current Technicians tab.

## Fix

Make the Current Technicians tab show only active workers by default, with an opt-in toggle to reveal removed ones (so admins can still Reactivate or Permanently Delete them).

### Changes

1. **`src/components/admin/WorkersManager.tsx`**
   - Add `showInactive` state (default `false`).
   - Extend `filteredWorkers` to also filter by `showInactive ? true : worker.is_active`.
   - Pass `showInactive` + setter to `WorkerFilters`.

2. **`src/components/admin/WorkerFilters.tsx`**
   - Add a small toggle/switch labelled "Show removed workers" next to the search box.
   - Show a count of inactive workers when toggled off (e.g. "2 removed hidden").

3. **`src/components/admin/WorkerTable.tsx` — optimistic update**
   - After `handleRemoveWorker` succeeds, immediately update local state so the row leaves the visible list without waiting for the parent refetch round-trip (parent `fetchWorkers` still runs as source of truth).
   - Same for `handleReactivateWorker` and `handlePermanentlyDeleteWorker`.

4. **Toast copy** — change "Worker has been removed successfully" to "Worker removed. Toggle 'Show removed workers' to restore." so the behavior is discoverable.

### Out of scope

- No RLS changes (admin update policy is working correctly).
- No change to the actual delete semantics — soft-remove stays soft-remove; permanent delete stays permanent.
- No pagination/server-side filtering rework.

### Verification

- Log in as admin → /admin → Technicians tab.
- Default view shows only `is_active=true` workers; the 2 already-inactive workers are hidden.
- Toggle "Show removed workers" → inactive workers appear with Inactive badge and Reactivate / Permanently Delete actions.
- Click Remove on an active worker → row disappears immediately; toggling Show removed reveals it.
- Click Reactivate → row leaves the inactive view and reappears in default view.
