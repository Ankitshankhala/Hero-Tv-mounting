# Users PII containment — design plan (authenticated role split)

## Threat model recap

`Authenticated can view active workers` policy on `public.users` has no column restriction and grants `SELECT` on all columns to any logged-in role. Because admin, worker, and customer all share the Postgres `authenticated` role, a regular signed-in customer can query `select id, name, email, phone, latitude, longitude, zip_code from users where role='worker'` and receive full PII. Postgres RLS is row-level, not column-level — so any fix must combine (a) revoking column privileges from `authenticated` and (b) routing admin/self reads through a privileged path.

## Full inventory of authenticated `users` reads

### Admin-only paths that read email / phone / other PII (safe to migrate — always behind admin-guarded routes)

| File | Columns selected | Notes |
|---|---|---|
| `src/hooks/useBookingManager.tsx:60,242` | `id, name, email, phone` | Used only in `admin/BookingsManager.tsx` (verified: sole importer). |
| `src/hooks/useAdminServiceAreas.ts:51,181` | `id, name, email, phone, is_active, created_at` | Admin service-area screens. |
| `src/components/admin/AssignWorkerModal.tsx:87` | `id, name, city, phone, email` | Also reads `email` from customer at :246. |
| `src/components/admin/EditBookingModal.tsx:86` | `id, name, email, phone, city` | Admin. |
| `src/components/admin/CreateBookingModal.tsx:80` | `id, name, email` | Admin. |
| `src/components/admin/AdminCalendarView.tsx:71` | `id, name, email` | Admin. |
| `src/components/admin/WorkerWeeklyPayments.tsx:69,113` | `id, name, email` and `id, name` | Admin. |
| `src/components/admin/WorkersManager.tsx:78` | `SELECT *` | Admin. Needs full row including `role`, `is_active`, timestamps. |
| `src/components/admin/ZctaManagementDashboard.tsx:81` | `id, name, email, phone` | Admin. |
| `src/components/admin/WorkerAssignmentManager.tsx:28,107` | `email, name` (worker) and `email` (customer) | Admin. |
| `src/components/admin/PendingWorkersManager.tsx:33` | `id, name, email, phone, city, zip_code, created_at, is_active` | Admin. |

### Non-admin paths that read a subset

| File | Columns | Legitimacy |
|---|---|---|
| `src/pages/CustomerDashboard.tsx:64` | `worker:users!worker_id(name, phone)` via bookings embed | **LEGITIMATE customer-sees-assigned-worker path.** Customer needs assigned worker's name + phone to contact them. Never sees email/coords. |
| `src/hooks/useAuth.tsx:100` | `select('*').eq('id', user.id)` | Own-profile self-read (any role). Needs all columns of own row (for `email`, `phone`, `role`). Covered by `Users can view own profile` RLS. |
| `src/hooks/useAuth.tsx:177` | `insert(...)` | Not a read. |
| `src/services/zctaOnlyService.ts:312` | `id, name` | Already trimmed in earlier fix. Runs under anon guest flow; safe. |
| `src/components/InlineBookingFlow.tsx:100` | `id, zip_code` | **Dead code** (confirmed earlier — no importers). |
| `src/hooks/booking/useBookingOperations.ts:451` | `.update(...)` on own row | Not a read. |
| `src/components/worker/WorkerProfileSettings.tsx:69` | `.update(...)` on own row | Not a read. |
| `src/components/admin/AddWorkerModal.tsx:84`, `src/components/admin/WorkerTable.tsx` (multiple), `src/components/worker/WorkerCreateBookingModal.tsx:171` | `.insert / .update / .delete` | Not reads. Governed by INSERT/UPDATE/DELETE policies, not affected by this fix. |
| `src/components/admin/SystemStatusCard.tsx:30` | `count` | Aggregation ping. |
| `src/hooks/useSupabaseQuery.tsx:49` | `select(select)` — dynamic | Only relevant if a caller passes 'users'; check at implementation time (currently no callers pass PII columns; treat as low risk). |

### Confirmation on question 2

**`useBookingManager` is admin-only.** Sole importer is `src/components/admin/BookingsManager.tsx` (rendered only inside the admin routes). No customer or worker context uses it. Safe to migrate to an admin-gated path.

## Customer-sees-their-worker requirement (question 4)

`CustomerDashboard.tsx:56–104` joins `worker:users!worker_id(name, phone)` on their own bookings. This is the only non-admin place a customer reads a worker's row. Required columns: **`name` and `phone`** (used at lines 83-84 as `worker.name` and `worker.phone`). Never reads `email`, `zip_code`, or coords. So the safe cross-role column boundary is:

- **Allowed to all `authenticated` (row = active worker):** `id, name, phone, city, role, is_active`
- **Admin-only:** `email`, `zip_code`, `latitude`, `longitude`, plus any other stored precise-location or provider-id columns.

Phone stays broad because Postgres RLS + column grants cannot condition "phone only if this worker is joined via my own booking" without an RPC/view — and keeping phone broad on active workers preserves both the customer-dashboard join AND every admin caller with zero code churn on the customer side. Acceptable given phone is contact info the platform is already surfacing to booked customers.

## Approach evaluation (question 3)

### Approach A — SECURITY DEFINER RPC (`get_workers_admin()`, `get_worker_contact(id)`)

- Every admin `.from('users')` call that reads email must become `.rpc('get_workers_admin')` or a filtered variant.
- Files to edit: ~11 admin files listed above, some with 2 call sites (14+ total edits). Return-type shape must match the current select columns per call site — each call site becomes a schema contract.
- `WorkersManager.tsx` does `SELECT * ... nested joins` (worker_service_areas etc.) — an RPC returning a flat rowset breaks the join. Would need either a dedicated RPC with a JSON return or a full refactor.
- Higher regression risk: every admin screen touched, mapping shapes, TypeScript type regeneration, and shared helpers.

### Approach B — SECURITY DEFINER view (`admin_worker_directory`) + column-restricted GRANT on `users`

- Create one view: `create view public.admin_worker_directory with (security_invoker = false) as select id, name, email, phone, city, zip_code, latitude, longitude, role, is_active, created_at, updated_at, ... from public.users where get_current_user_role() = 'admin';` (or use SECURITY DEFINER function-wrapping if `security_invoker=false` doesn't behave; Postgres 15+ supports `security_invoker` on views — this DB has `security_definer_view` warnings already, meaning the pattern is used).
- Non-admin callers of the view get zero rows — no PII leak.
- REVOKE SELECT on `public.users` FROM authenticated, then GRANT SELECT (id, name, phone, city, role, is_active) ON public.users TO authenticated. Own-row full-column read moves through a small `get_my_profile()` RPC (single caller: `useAuth.tsx:100`). Nested joins to `users!worker_id(name, phone)` in bookings queries KEEP WORKING because those two columns are in the authenticated grant.
- Files to edit: only the admin files that currently need `email` and other admin-only PII. `WorkersManager.tsx` can join against the view instead of the base table. Admin files that only read `id, name` or `id, name, phone` (e.g. `WorkerWeeklyPayments.tsx:113`, `AssignWorkerModal.tsx` if trimmed, `AdminCalendarView.tsx`, `CreateBookingModal.tsx`) can either keep raw `users` or migrate — non-blocking.
- Regression surface is smaller and more localized; the customer-dashboard join is untouched.

### Approach C — pure policy rewrite (rejected)

Row-level policies alone cannot distinguish column access by role for a shared Postgres role. Any fix that keeps unrestricted `GRANT SELECT` on `users` to `authenticated` leaves the door open. Not viable.

## Recommendation

**Approach B (view + column-restricted GRANT + one own-profile RPC).**

Reasons:
1. Preserves the legitimate customer-sees-worker join with **zero customer-side code changes** — `worker:users!worker_id(name, phone)` still resolves because those columns are granted.
2. Enforces PII containment at the database layer for **all** authenticated non-admin callers, including any future components we forget about.
3. Minimum admin-side churn: only files that select `email` / `zip_code` / coords need migration to the view (roughly 8 files, mostly one line each — change `.from('users')` to `.from('admin_worker_directory')` and keep `.eq('role','worker')` if desired, or drop it since the view already scopes).
4. `useAuth` own-profile read migrates to a single `get_my_profile()` RPC (or a `security_invoker` view returning `where id = auth.uid()`), which is one small edit.
5. Aligns with the pattern used earlier in this project (`has_role` SECURITY DEFINER, `get_current_user_role`, and column-scoped GRANTs already applied to `anon` on `users` and `coupons`).

## Proposed migration + code-change checklist (for the follow-up build turn)

1. Migration:
   - Create `public.admin_worker_directory` view, security definer (or `security_invoker=false`), filter body `where get_current_user_role() = 'admin'` on top of `users`. Grant SELECT on the view to `authenticated`.
   - Create SECURITY DEFINER function `public.get_my_profile()` returning the caller's `users` row (`where id = auth.uid()`). Grant EXECUTE to `authenticated`.
   - REVOKE SELECT ON public.users FROM authenticated.
   - GRANT SELECT (id, name, phone, city, role, is_active) ON public.users TO authenticated.
   - Leave existing SELECT RLS policies as-is (they still control which rows the granted columns reveal). Optionally simplify the "active workers" policy since column grants now enforce PII containment.
2. Code migrations (approx. 8 admin files):
   - useBookingManager (both queries) → `admin_worker_directory`
   - useAdminServiceAreas (both queries) → `admin_worker_directory`
   - AssignWorkerModal:87, EditBookingModal:86, CreateBookingModal:80, AdminCalendarView:71, WorkerWeeklyPayments:69, ZctaManagementDashboard:81, WorkerAssignmentManager:28, PendingWorkersManager:33 → `admin_worker_directory`
   - WorkersManager:78 (`SELECT *` w/ joins) → validate the view exposes the columns/joins needed; either use the view or split the query.
   - useAuth:100 (`select('*').eq('id', user.id)`) → `.rpc('get_my_profile')`.
3. Verification:
   - Typecheck.
   - Playwright smoke: log in as customer, verify dashboard shows assigned worker `name` + `phone`; log in as admin, verify Workers panel + Assign Worker modal + Weekly Payments show email/phone as before.
   - Log in as customer, run in DevTools `supabase.from('users').select('email').eq('role','worker')` and confirm response contains no `email` values (either error or nulls per PostgREST behavior with denied columns).

## Out of scope for this fix

- `stripe_customer_id` — governed separately by `stripe_customers` table.
- Column-restricting `phone` further to only the customer's own assigned worker (would require an RPC; not worth the complexity vs. current risk).
- The remaining duplicate INSERT/UPDATE own-profile policies on `users`.
- The pre-existing 8 `Security Definer View` linter errors — unrelated to this change, but adding one more definer view here is consistent with the existing pattern.
