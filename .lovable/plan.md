
# Users Table & Worker PII Dependency Map (read-only reference)

No code will change from this plan. Approve to move to a build-mode fix plan afterward.

## 1. Current DB State (live, verified)

**Migration 20260713040005 IS applied.** Concrete state:

- View `public.admin_worker_directory`: EXISTS. Columns: `id, email, name, phone, city, zip_code, latitude, longitude, reason, role, is_active, created_at, updated_at, stripe_customer_id, stripe_default_payment_method_id, has_saved_card`. Grants: full `arwdDxtm` to anon, authenticated, service_role (view is NOT role-gated at grant level — it must be gated by a `WHERE` clause using `get_current_user_role()`; that predicate must be re-verified by dumping `pg_get_viewdef`).
- RPC `public.get_my_profile()`: EXISTS. SECURITY DEFINER, returns `public.users`, filters `id = auth.uid()`.
- RPC `public.get_worker_contact(...)`: DOES NOT EXIST.
- `get_current_user_role()`: EXISTS. SECURITY DEFINER, `SELECT role FROM public.users WHERE id = auth.uid()`.

**Table-level grants on `public.users`** (from `pg_class.relacl`):
- anon: INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN — **no SELECT**
- authenticated: same as anon — **no SELECT**
- service_role: all including SELECT

**Column-level SELECT grants on `public.users`** (from `pg_attribute.attacl`):
- anon: `id`, `name`
- authenticated: `id`, `name`, `city`, `is_active`, `phone`, `role`
- service_role: all (via table grant)

Columns NOT readable by authenticated (and therefore currently silently dropped from every `.from('users').select(...)` in the app): `email, zip_code, latitude, longitude, reason, created_at, updated_at, stripe_customer_id, stripe_default_payment_method_id, has_saved_card, address, bio` (and any other column not in the six above).

**RLS policies on `public.users`** (redundant, some overlap):
- `Users can view own profile` — SELECT, authenticated, `id = auth.uid()`
- `Authenticated can view active workers` — SELECT, authenticated, `role='worker' AND is_active`
- `Anon can view active workers (basic)` — SELECT, anon, `role='worker' AND is_active`
- `Admins can manage all users` — ALL, public, `get_current_user_role()='admin'`
- `Users can update own profile` / `Users can update their own profile` / `Enable profile updates` — UPDATE (three overlapping)
- `Enable user registration` / `Users can insert own profile` — INSERT (two overlapping)

Note: RLS filters rows; column grants filter columns. Column grants are the reason `email` is currently null in admin UIs even though RLS would allow it.

## 2. Reads of `public.users` — full inventory

Auth context legend: **AN**=anon, **CU**=authenticated-customer, **AD**=authenticated-admin, **WK**=authenticated-worker, **SR**=service_role edge function, **ANY-AUTH**=any signed-in role.

### Direct `.from('users')` reads

| File:line | Columns selected | Context | Notes |
|---|---|---|---|
| src/hooks/useAuth.tsx:100 | `*` | ANY-AUTH (own profile) | `.eq('id', user.id)`. Currently returns only 6 granted cols; email/zip/stripe fields silently dropped. |
| src/components/ConnectionTester.tsx:100 | `id, name, role` | ANY-AUTH | Own profile probe. OK under current grants. |
| src/components/admin/SystemStatusCard.tsx:30 | `count` | AD | Health check. OK. |
| src/components/admin/WorkersManager.tsx:78 | `*, worker_availability(day_of_week,start_time,end_time)` | AD | Embed to `worker_availability`. **Currently missing email/etc.** |
| src/components/admin/WorkerTable.tsx (via WorkersManager) | — | AD | (writes only, listed §3) |
| src/components/admin/AssignWorkerModal.tsx:87 | `id, name, city, phone, email` | AD | email currently null. |
| src/components/admin/AssignWorkerModal.tsx:246 | `email` | AD | Customer email lookup. Currently null. |
| src/components/admin/EditBookingModal.tsx:86 | `id, name, email, phone, city` | AD | email currently null. |
| src/components/admin/CreateBookingModal.tsx:80 | `id, name, email` | AD | email currently null. |
| src/components/admin/AdminCalendarView.tsx:71 | `id, name, email` | AD | email currently null. |
| src/components/admin/WorkerWeeklyPayments.tsx:69 | `id, name, email` | AD | email currently null. |
| src/components/admin/WorkerWeeklyPayments.tsx:113 | `id, name` | AD | OK. |
| src/components/admin/ZctaManagementDashboard.tsx:81 | `id, name, email, phone` | AD | email currently null. |
| src/components/admin/WorkerAssignmentManager.tsx:28 | `email, name` | AD | email currently null. |
| src/components/admin/WorkerAssignmentManager.tsx:107 | `email` | AD | Customer lookup. Null. |
| src/components/admin/PendingWorkersManager.tsx:33 | `id, name, email, phone, city, zip_code, created_at, is_active` | AD | **Most columns currently null**. |
| src/components/admin/WorkerApplicationsManager.tsx:56 | `id, email, name` | AD | Null. |
| src/hooks/useAdminServiceAreas.ts:51 | `id, name, email, phone, is_active, created_at` | AD | Null on email/created_at. |
| src/hooks/useAdminServiceAreas.ts:181 | `id, name, email, phone, is_active` | AD | Same. |
| src/hooks/useBookingManager.tsx:60 | `id, name, email, phone` | AD (BookingsManager, admin-only) | email/phone null. |
| src/hooks/useBookingManager.tsx:242 | `id, name, email, phone` | AD | Same. |
| src/services/zctaOnlyService.ts:311 | `id, name` | ANY (invoked in booking flow, may be AN or CU) | OK under both anon+authenticated grants. |
| src/components/InlineBookingFlow.tsx:100 | `id, zip_code` | AN or CU (guest booking) | **zip_code NOT granted to anon or authenticated** → returns null → filter breaks. |
| src/components/InlineBookingFlow.tsx:80 | embed `users!inner(zip_code)` inside bookings select | AN or CU | Same problem. |
| src/utils/createTestBooking.ts:20,30 | `*` / insert | dev util | Non-prod. |
| **Edge fns (SR)** — `payment-engine:161`, `worker-reassign-booking:63/105/173`, `worker-reschedule-booking:65/159`, `send-worker-assignment-notification:60`, `send-increment-notification:43`, `send-customer-booking-confirmation-email:118`, `cleanup-unpaid-bookings:54`, `assign-authorized-booking-worker:273`, `admin-process-refund:37`, `delete-transactions:35` | various | SR | Service role bypasses everything. **No impact from column-grant changes.** |

### Embed reads (`users!fk(...)` inside another table's select) — cannot swap to a view via PostgREST

| File:line | Embed shape | Context | Notes |
|---|---|---|---|
| src/pages/CustomerDashboard.tsx:64 | `worker:users!worker_id(name, phone)` | CU (own bookings) | Legit customer-sees-assigned-worker case. Under current grants: OK (name+phone granted). |
| src/pages/WorkerDashboard.tsx:208 | `customer:users!customer_id(name, phone)` | WK | OK. |
| src/pages/WorkerDashboardWithSidebar.tsx:161 | `users!customer_id(id,name,email,phone)` | WK | **email null under current grants.** |
| src/components/AvailabilityCalendar.tsx:58 | `users!worker_id(id,name,city)` | AD (likely) | OK. |
| src/components/booking/CalendarView.tsx:82 | `users!worker_id(name)` | AD | OK. |
| src/components/admin/AdminCalendarView.tsx:94,95 | `customer:users!customer_id(name,email,phone,city)`, `worker:users!worker_id(name,email,phone)` | AD | **email null**. |
| src/components/admin/AssignWorkerModal.tsx:72 | `customer:users!customer_id(name, city)` | AD | OK. |
| src/components/admin/CoverageRequestsManager.tsx:51,55 | `customer:...(name,city)`, `worker:...(name,phone)` | AD | OK. |
| src/components/admin/CustomerHistoryModal.tsx:34 | `worker:users!worker_id(name)` | AD | OK. |
| src/components/admin/ManualTipCorrection.tsx:74,114 | `users!customer_id(name,email)` | AD | **email null**. |
| src/components/admin/TodaysJobsModal.tsx:53,55 | `customer:...(name,phone)`, `worker:...(name,phone)` | AD | OK. |
| src/components/admin/WorkerTipTracker.tsx:60,129 | `users!worker_id(name)`, `users!customer_id(name)` | AD | OK. |
| src/components/worker/WorkerEarnings.tsx:84 | `users!customer_id(email)` | WK | **email null**. |
| src/components/worker/WorkerWeeklyEarnings.tsx:61 | `users!customer_id(name)` | WK | OK. |
| src/components/admin/WorkerApplicationsManager.tsx (see above) | direct | AD | — |
| src/hooks/useWorkerCoverageNotifications.tsx:46 | `customer:users!customer_id(name, city)` | WK | OK. |
| src/hooks/booking/useBookingOperations.ts:587 | `customer:users!customer_id(*)` | ANY-AUTH | Widescan on users; most cols null. |
| src/hooks/booking/useBookingOperations.ts:851,852 | `customer:users!customer_id(*)`, `worker:users!worker_id(*)` | ANY-AUTH | Same. |

### Dynamic reads

| File:line | Notes |
|---|---|
| src/hooks/useSupabaseQuery.tsx:49 | Generic `.from('users').select(select)` — callers pass select string. Grep sites relying on this are unclear; treat as authenticated context. |

## 3. Writes to `public.users` — full inventory

| File:line | Op | Payload | Context |
|---|---|---|---|
| src/hooks/useAuth.tsx:177 | insert | id, email, name, phone, city, role | Signup (public, becomes authenticated as inserter) |
| src/components/admin/AddWorkerModal.tsx:84 | insert | id, email, name, phone, city, role='worker' | AD |
| src/components/worker/WorkerCreateBookingModal.tsx:170 | insert | name, email, phone, role='customer' | WK creating guest customer row |
| src/utils/createTestBooking.ts:29 | insert | test fixture | dev |
| src/components/admin/PendingWorkersManager.tsx:56 | update | `is_active:true` | AD (approve) |
| src/components/admin/PendingWorkersManager.tsx:82 | delete | — | AD (reject) |
| src/components/admin/WorkerTable.tsx:90/116/167/187 | update | `is_active` toggle | AD |
| src/components/admin/WorkerTable.tsx:179 | delete | hard delete w/ soft fallback | AD |
| src/components/worker/WorkerProfileSettings.tsx:69 | update | name, phone, address, bio | WK own profile |
| src/hooks/booking/useBookingOperations.ts:451 | update | zip_code, city (only if null) | CU own profile backfill |

**Impact on writes if we change SELECT column grants:** none. Writes use INSERT/UPDATE/DELETE table-level grants (still present) plus RLS. However, PostgREST `RETURNING` on writes returns columns per the caller's grants; components that read back full rows after write will silently lose the ungranted columns (already the case today).

## 4. Approach-B swap analysis: 13 admin files → `admin_worker_directory`

For each admin file that reads worker PII, the exact transform. Every one currently selects a direct `.from('users')` shape that can trivially become `.from('admin_worker_directory')` **with one caveat**: PostgREST joins/embeds only follow declared foreign keys, so replacing the base table works for standalone selects but **cannot** replace embeds like `worker:users!worker_id(...)`.

Direct-select swaps (trivial):
| File:line | Current | Becomes |
|---|---|---|
| WorkersManager.tsx:78 | `.from('users').select('*, worker_availability(...)').eq('role','worker')` | **Blocker.** The view has no FK to `worker_availability`, so the embed will not resolve. Options: (a) two queries + JS merge; (b) select from `admin_worker_directory` and separately fetch `worker_availability` in `.in('worker_id', ids)`. |
| AssignWorkerModal.tsx:87 | `id, name, city, phone, email` where role=worker,is_active | `.from('admin_worker_directory').select('id,name,city,phone,email').eq('is_active',true)` (view already limits to workers via internal filter — must confirm from `pg_get_viewdef`). |
| AssignWorkerModal.tsx:246 (customer email) | `email` where `id=customer_id` | **Not a worker.** View is worker-only; can't use it for customers. Needs different mechanism (edge function or column-grant-based). |
| EditBookingModal.tsx:86 | `id,name,email,phone,city` workers | swap directly. |
| CreateBookingModal.tsx:80 | `id,name,email` workers | swap directly. |
| AdminCalendarView.tsx:71 (worker list) | `id,name,email` workers | swap directly. |
| AdminCalendarView.tsx:94,95 (embeds) | `customer:users!customer_id(...email...)`, `worker:users!worker_id(...email...)` | **Blocker: embed.** Must be split — fetch bookings without the embed, then batch-fetch worker rows via `admin_worker_directory` and customer rows via a separate mechanism, merge in JS. |
| WorkerWeeklyPayments.tsx:69 | `id,name,email` workers | swap directly. |
| WorkerWeeklyPayments.tsx:113 | `id,name` customers | not a worker path; unrelated to PII fix. |
| ZctaManagementDashboard.tsx:81 | `id,name,email,phone` workers | swap directly. |
| WorkerAssignmentManager.tsx:28 | `email,name` for a worker id | swap directly. |
| WorkerAssignmentManager.tsx:107 | `email` for a customer | **Not a worker.** Same problem as AssignWorkerModal:246. |
| PendingWorkersManager.tsx:33 | `id,name,email,phone,city,zip_code,created_at,is_active` where `role=worker AND is_active=false` | **Blocker: view is `is_active=true` only (assumed; confirm from `pg_get_viewdef`).** If so, pending (inactive) workers won't appear in the view. |
| useAdminServiceAreas.ts:51,181 | `id,name,email,phone,is_active[,created_at]` workers | swap directly (again pending on view filter). |
| useBookingManager.tsx:60,242 | `id,name,email,phone` workers | swap directly. |

**Customer-PII reads inside admin embeds** (AdminCalendarView:94, ManualTipCorrection, WorkerDashboardWithSidebar, WorkerEarnings) are NOT covered by `admin_worker_directory` — that view is worker-scoped. These need their own solution (customer_email lookup RPC, or expanded column grants for admin role via a separate view, or restructure to guest_customer_info which stores email in the booking row).

## 5. What would break if we (re-)apply `GRANT SELECT (id,name,phone,city,role,is_active) ON public.users TO authenticated`

That grant is already effectively in place today. Comparing to the exhaustive read list, the columns currently NOT granted but referenced by non-admin authenticated code are:

| Path | Column read | Impact today | If we widen grants |
|---|---|---|---|
| useAuth.tsx:100 (own profile `select('*')`) | email, zip_code, address, bio, stripe_*, created_at, updated_at, is_active | **BROKEN today** — user's own email/etc. return null on refresh. | Fix by switching to `get_my_profile()` RPC. |
| ConnectionTester.tsx | id,name,role | fine | fine |
| CustomerDashboard.tsx:64 (embed worker name+phone) | name,phone | fine | fine |
| WorkerDashboard.tsx:208 (embed customer name+phone) | name,phone | fine | fine |
| WorkerDashboardWithSidebar.tsx:161 (embed customer id,name,email,phone) | email | **broken today** | still broken unless customer-email path is added |
| WorkerEarnings.tsx:84 (embed customer email) | email | **broken today** | still broken |
| InlineBookingFlow.tsx:80,100 (zip_code) | zip_code | **broken today** (used by guest booking flow — check whether this is executed in anon or authenticated context; either way, `zip_code` is ungranted) | still broken — must move to a coverage-check RPC/edge fn or via `admin_worker_directory` (but that's admin-only) |
| useBookingOperations.ts embeds `(*)` | wide | many columns null today | many columns still null |
| zctaOnlyService.ts:311 | id,name | fine | fine |
| WorkerProfileSettings.tsx (writes+read) | reads via `select('*')`? No — write only. | — | — |

**Non-admin authenticated code paths that need attention regardless of Approach A/B:**
1. `useAuth.tsx` own-profile widescan → switch to `get_my_profile()` RPC.
2. `useBookingOperations.ts:587,851,852` widescan embeds → tighten to the specific columns actually rendered.
3. `InlineBookingFlow.tsx:80,100` reading `zip_code` from users to compute coverage → replace with a coverage RPC (there are already candidates like `find_available_workers_by_zip`, `find_workers_for_coverage`).
4. `WorkerDashboardWithSidebar.tsx:161` and `WorkerEarnings.tsx:84` reading customer `email` → either drop the column (email is derivable from `guest_customer_info` for guest bookings, unavailable for registered customers under new rules) or add a customer-email RPC.

## 6. Triggers, RLS helpers, SECURITY DEFINER functions that read `public.users`

No `pg_trigger` rows on `public.users`. Twenty SECURITY DEFINER functions reference `public.users` in their body (verified list):

`auto_assign_worker_by_zip, auto_assign_workers_to_booking, auto_assign_workers_with_polygon_coverage, auto_assign_workers_with_strict_zip_coverage, find_available_workers_by_zip, find_workers_for_coverage, get_active_impersonation, get_available_time_slots, get_current_user_role, get_my_profile, get_worker_weekly_availability, get_workers_for_admin, prevent_role_self_escalation, reassign_bookings_for_zipcode, resend_customer_sms, retry_unsent_notifications_for_booking, set_worker_weekly_availability, start_impersonation_session, validate_booking_has_coverage, validate_worker_booking_assignment`.

All are SECURITY DEFINER, so they read `users` under the function owner's rights and bypass column grants. **Restricting column grants does not affect these.** `get_workers_for_admin` is an already-existing helper that could be a cleaner alternative to a view for admin worker listings — worth inspecting before finalizing Approach B.

## 7. Redundancies noted (for future cleanup, not this fix)

- Two identical INSERT policies (`Enable user registration` vs `Users can insert own profile`).
- Three overlapping UPDATE policies (`Users can update own profile`, `Users can update their own profile`, `Enable profile updates`).
- `Anon can view active workers (basic)` policy exists but anon has no useful column grants beyond `id,name` — effectively harmless but noisy.

## 8. Open items to confirm before designing the fix

1. Exact `WHERE` clause of `admin_worker_directory` view: does it embed `get_current_user_role()='admin'`? Does it restrict to `is_active=true` (which would break PendingWorkersManager)? Need `pg_get_viewdef('public.admin_worker_directory')` before choosing Approach B.
2. What `get_workers_for_admin` returns and its filter — it may already be the cleaner path.
3. For the ~4 customer-email admin reads, decide the mechanism: (a) admin-only view `admin_customer_directory`, (b) explicit RPC, or (c) accept guest_customer_info as the source of truth and drop registered-customer email from admin embeds.
4. Whether `InlineBookingFlow.tsx` coverage query should move to an existing SECURITY DEFINER RPC rather than a direct users read (recommended regardless).

This document is the complete map you asked for. On approval I can produce a targeted fix plan (Approach B refined for embeds + customer-email path + own-profile RPC swap + InlineBookingFlow RPC swap).
