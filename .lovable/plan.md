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
| `src/components/admin/WorkersManager.tsx:78` | `SELECT *` with embedded `worker_availability(...)` join | Admin. |
| `src/components/admin/ZctaManagementDashboard.tsx:81` | `id, name, email, phone` | Admin. |
| `src/components/admin/WorkerAssignmentManager.tsx:28,107` | `email, name` (worker) and `email` (customer) | Admin. |
| `src/components/admin/PendingWorkersManager.tsx:33` | `id, name, email, phone, city, zip_code, created_at, is_active` | Admin. |

### Non-admin paths that read a subset

| File | Columns | Legitimacy |
|---|---|---|
| `src/pages/CustomerDashboard.tsx:64` | `worker:users!worker_id(name, phone)` via bookings embed | **LEGITIMATE customer-sees-assigned-worker path.** Customer needs assigned worker's name + phone. Never sees email/coords. |
| `src/hooks/useAuth.tsx:100` | `select('*').eq('id', user.id)` | Own-profile self-read. Needs all columns of own row. Covered by `Users can view own profile` RLS. |
| `src/services/zctaOnlyService.ts:312` | `id, name` | Already trimmed. Runs under anon; safe. |
| `src/components/InlineBookingFlow.tsx:100` | `id, zip_code` | **Dead code** (no importers). |
| `useBookingOperations.ts:451`, `WorkerProfileSettings.tsx:69` | `.update(...)` on own row | Not reads. |
| Various admin | `.insert / .update / .delete` | Not reads. |
| `SystemStatusCard.tsx:30` | `count` | Ping. |
| `useSupabaseQuery.tsx:49` | dynamic | No current callers request PII. |

### Confirmation on question 2

**`useBookingManager` is admin-only.** Sole importer is `src/components/admin/BookingsManager.tsx`. Never rendered for customers or workers. Safe to migrate to an admin-gated path.

## Customer-sees-their-worker requirement

`CustomerDashboard.tsx:56–104` joins `worker:users!worker_id(name, phone)` on the customer's own bookings and renders `worker.name` + `worker.phone` (lines 83–84). Never reads `email`, `zip_code`, or coords. Safe cross-role column boundary:

- **Allowed to all `authenticated` (row = active worker):** `id, name, phone, city, role, is_active`
- **Admin-only:** `email`, `zip_code`, `latitude`, `longitude`, `stripe_customer_id`, `stripe_default_payment_method_id`, `has_saved_card`

Phone stays broad on the base table because RLS + column grants can't condition "phone only if this worker is joined via my own booking" without an RPC — and keeping phone broad preserves the customer-dashboard join with zero customer-side changes. Acceptable because platform already surfaces the assigned worker's phone to booked customers.

## Approach evaluation

### Approach A — SECURITY DEFINER RPC (`get_workers_admin()`, `get_worker_contact(id)`)

- Every admin `.from('users')` call becomes `.rpc(...)`. ~14 call sites edited.
- Return-shape becomes a schema contract per RPC; TS types must match every current select shape.
- `WorkersManager.tsx` uses `SELECT * ... worker_availability(...)` embed → RPC breaks the embed, needs JSON return or refactor to two calls anyway.
- Higher regression risk: every admin screen touched, mapping shapes.

### Approach B — SECURITY DEFINER view (`admin_worker_directory`) + column-restricted GRANT on `users`

- One view: `SELECT (full worker cols) FROM users WHERE get_current_user_role()='admin'`. Non-admins get zero rows.
- `REVOKE SELECT ON public.users FROM authenticated`, then `GRANT SELECT (id, name, phone, city, role, is_active) ON public.users TO authenticated`. Own-row full-column read moves through a `get_my_profile()` RPC (single caller: `useAuth.tsx:100`).
- Customer-dashboard embed `worker:users!worker_id(name, phone)` KEEPS WORKING — those columns remain granted.
- Files to edit: ~11 admin files (mostly one-line `.from('users')` → `.from('admin_worker_directory')`). `WorkersManager` splits into two queries (workers from view, availability separately, merge).
- Aligns with the pattern already used in this project (`get_current_user_role`, column-scoped anon GRANTs on `users` and `coupons`).

### Approach C — pure policy rewrite (rejected)

Row-level policies can't distinguish column access by role for a shared Postgres role.

## Recommendation

**Approach B (view + column-restricted GRANT + one own-profile RPC).**

Reasons:
1. Preserves the legitimate customer-sees-worker join with **zero customer-side changes**.
2. Enforces PII containment at the DB layer for all non-admin `authenticated` callers, including future components.
3. Minimum admin churn: mostly one-line `.from(...)` swaps.
4. `useAuth` own-profile read migrates to a single `get_my_profile()` RPC.

## Proposed migration + code-change checklist

1. Migration:
   - `CREATE VIEW public.admin_worker_directory WITH (security_invoker=true) AS SELECT ... FROM users WHERE get_current_user_role()='admin';`
   - `GRANT SELECT ON public.admin_worker_directory TO authenticated;`
   - `CREATE FUNCTION public.get_my_profile() RETURNS public.users LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT * FROM users WHERE id=auth.uid(); $$;` + `GRANT EXECUTE TO authenticated`.
   - `REVOKE SELECT ON public.users FROM authenticated;`
   - `GRANT SELECT (id, name, phone, city, role, is_active) ON public.users TO authenticated;`
2. Code migrations (~12 files):
   - `useBookingManager` (2 sites), `useAdminServiceAreas` (2), `AssignWorkerModal` (2), `EditBookingModal`, `CreateBookingModal`, `AdminCalendarView`, `WorkerWeeklyPayments` (line 69 only; line 113 stays on `users`), `ZctaManagementDashboard`, `WorkerAssignmentManager` (2), `PendingWorkersManager` → `.from('admin_worker_directory' as any)`.
   - `WorkersManager` → split into `admin_worker_directory` query + separate `worker_availability` fetch, merge in JS.
   - `useAuth:100` → `.rpc('get_my_profile' as any).maybeSingle()`.
3. Verification:
   - Typecheck.
   - Manual admin: BookingsManager, WorkersManager, AssignWorkerModal, Weekly Payments, ZCTA — email/phone visible.
   - Manual customer: CustomerDashboard shows assigned worker `name` + `phone`; own profile renders.
   - Adversarial customer DevTools: `supabase.from('users').select('email').eq('role','worker')` returns `email: null`; `supabase.from('admin_worker_directory').select('*')` returns empty.

## Rollback (single migration if regression)

```sql
GRANT SELECT ON public.users TO authenticated;
```

## Out of scope

- `stripe_customers` table (separate).
- Column-restricting `phone` further via RPC.
- Duplicate INSERT/UPDATE own-profile policies on `users`.
- Pre-existing `Security Definer View` linter warnings unrelated to this change.
