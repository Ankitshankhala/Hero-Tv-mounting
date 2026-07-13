## H1 Diagnosis Report — Worker PII Exposure to Authenticated Customers

**Root cause confirmed.** RLS policy `Authenticated can view active workers` on `public.users` allows any `authenticated` role (customer OR admin) to `SELECT *` where `role='worker' AND is_active`. Postgres role is shared; RLS only filters rows, not columns. Customers can therefore read `email`, `phone`, `latitude`, `longitude`, `zip_code`, `stripe_customer_id` of every active worker via a crafted query. No frontend UI displays this to customers, but the data is reachable via the Data API.

---

### 1. Frontend reads of worker email/phone under authenticated context

All are **admin-only routes** (`/admin`, gated by role check in `Admin.tsx` + admin components):

| File | Columns selected | Reachable by non-admin? |
|---|---|---|
| `hooks/useBookingManager.tsx:60,242` | `id, name, email, phone` | No — only used by `admin/BookingsManager.tsx`, mounted under `/admin` |
| `hooks/useAdminServiceAreas.ts:51,181` | `id, name, email, phone, is_active` | No — admin service-areas UI |
| `admin/AssignWorkerModal.tsx:87,246` | `id, name, city, phone, email` (worker list) + customer `email` | No |
| `admin/EditBookingModal.tsx:86` | `id, name, email, phone, city` | No |
| `admin/CreateBookingModal.tsx:80` | `id, name, email` | No |
| `admin/AdminCalendarView.tsx:71,95` | `id, name, email` + `worker:users!worker_id(name, email, phone)` embed | No |
| `admin/WorkerWeeklyPayments.tsx:69` | `id, name, email` | No |
| `admin/ZctaManagementDashboard.tsx:81` | `id, name, email, phone` | No |
| `admin/WorkersManager.tsx:78` | `*` (all columns, incl. coords, stripe_customer_id) | No |
| `admin/WorkerAssignmentManager.tsx:28,107` | worker + customer email | No |
| `admin/PendingWorkersManager.tsx:33,56,82` | full PII | No |
| `admin/WorkerTable.tsx` (5 spots) | full PII | No |
| `admin/AddWorkerModal.tsx:84`, `SystemStatusCard.tsx:30`, `WorkerApplicationsManager.tsx:56` | admin-only | No |

**Non-admin authenticated reads of `users`:**
- `hooks/useAuth.tsx:100,177` — own profile (`.eq('id', user.id)`)
- `pages/CustomerDashboard.tsx:64` — `worker:users!worker_id(name, phone)` embed on customer's own bookings
- `components/AvailabilityCalendar.tsx:58`, `booking/CalendarView.tsx:82` — worker `name` only for scheduling display
- `services/zctaOnlyService.ts:312` — now trimmed to `id, name, city` (per prior fix)
- `hooks/booking/useBookingOperations.ts:451,852` — booking flow worker lookups

### 2. `useBookingManager` scope

Imported only by `src/components/admin/BookingsManager.tsx`, which is lazy-loaded exclusively by `pages/Admin.tsx` under the `/admin` route. **Not rendered outside admin.** Safe to assume admin context.

### 3. Recommendation: **Approach B — SECURITY DEFINER view (`admin_worker_directory`)** + column-restricted GRANT on `users`

Comparison for this codebase:

| | (A) RPCs per use case | (B) Admin view + column grants |
|---|---|---|
| Files edited | ~15 hooks/components, each rewritten to call a new RPC and reshape results | ~13 admin files: swap `.from('users')` → `.from('admin_worker_directory')`; leave column names identical |
| Embed queries (`worker:users!worker_id(...)`) | Cannot be replaced by RPC — must be split into 2 round-trips and merged in JS (breaks `AdminCalendarView`, `CustomerDashboard` shape) | Customer embed keeps working because column-grant on base `users` still permits `name, phone` join; admin embeds must move to a separate lookup (only `AdminCalendarView` affected) |
| `WorkersManager` `select('*', worker_availability(...))` | Requires new RPC returning nested availability | View can include worker rows; availability needs a separate fetch either way |
| `useAuth` own-profile | Needs `get_my_profile()` RPC in either approach (base-table SELECT is revoked) | Same |
| Type safety | Manual TS types per RPC | View is auto-typed in `types.ts` after migration |
| Regression risk | Higher — every call site restructured | Lower — mostly a string swap, same shape |
| Ongoing maintenance | New RPC per new admin column need | Add columns to view once |

**Recommendation: Approach B.** Fewer edits, preserves existing query shapes, view is auto-typed, one central place to audit admin PII access.

Note: your previous session already executed migration `20260713040005_*` implementing exactly this (view + RPC + column grant). Verify with `supabase--read_query` before proposing a new migration.

### 4. Customer's legitimate view of their assigned worker

- **Component:** `pages/CustomerDashboard.tsx:64`
- **Fields shown:** `name, phone` (embedded through `bookings` → `users!worker_id`)
- **Rationale:** customer needs to contact/identify the technician arriving at their home.
- **Preservation:** column grant `GRANT SELECT (id, name, phone, city, role, is_active) ON public.users TO authenticated;` keeps this join working without exposing `email`, coords, or `stripe_customer_id`.

Also relied on by `AvailabilityCalendar` and `booking/CalendarView` (name only) — both covered by the same grant.

---

### Proposed follow-up (build mode) — no changes yet

1. **Verify** DB state matches design (view + RPC + column grant exist).
2. **Edit ~13 admin files** to swap `.from('users')` → `.from('admin_worker_directory')` where email/phone/coords are needed.
3. **Edit `AdminCalendarView.tsx`** to drop `email, phone` from the `worker:users!worker_id(...)` embed and, if admins truly need worker contact there, fetch separately from the view.
4. **Edit `useAuth.tsx`** to use `get_my_profile()` RPC instead of `select('*')` on `users`.
5. **Regression checks:** admin bookings list, worker assignment modal, admin calendar, worker payments, ZCTA dashboard, customer dashboard (worker name+phone still shows), booking flow ZIP coverage.

Awaiting your review before switching to build mode.