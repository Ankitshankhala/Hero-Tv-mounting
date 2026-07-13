
# Diagnostic Report — read-only, no edits

## 3. Active booking flow (answer first, since it affects #2)

**`EnhancedInlineBookingFlow.tsx` is the live component.** Both routed pages import it:
- `src/pages/Index.tsx:18` — `lazy(() => import('@/components/EnhancedInlineBookingFlow'))`, rendered at line 274; also prefetched at line 43.
- `src/pages/cities/CityPage.tsx:8` — named import, rendered at line 305.

**`InlineBookingFlow.tsx` is dead code.** No import of it exists anywhere in `src/`. It still contains a `.from('users').eq('role','worker')` query, but nothing mounts it. Safe to ignore for RLS scoping (and a candidate for deletion in a separate cleanup).

`EnhancedInlineBookingFlow.tsx` itself does **not** query the `users` table directly — worker/coverage lookups in that flow go through hooks/services listed below (e.g. `useZctaWorkerAvailability`, `zctaOnlyService`, `zctaServiceOptimized`), not through an inline `.from('users')`.

---

## 1. Every `.from('coupons')` in `src/`

Only two files. No checkout/admin component queries `coupons` directly — all validation goes through the `validate-coupon` edge function.

| File | Op | Columns | Filters |
|---|---|---|---|
| `src/hooks/useCoupons.ts:48` | select | `*` | none, ordered by `created_at desc` (admin list) |
| `src/hooks/useCoupons.ts:69` | insert | — | admin create |
| `src/hooks/useCoupons.ts:97` | update | — | `eq('id', id)` (admin edit) |
| `src/hooks/useCoupons.ts:127` | update (soft-delete) | `is_active=false` | `eq('id', id)` |
| `src/hooks/useCoupons.ts:173` | select count | `*` head-only | `eq('is_active', true)` (analytics) |
| `src/hooks/useCoupons.ts:188` | select | `code, usage_count` | order by `usage_count desc` limit 1 (analytics) |
| `src/hooks/usePublicCoupons.ts:30` | select | `id, code, discount_type, discount_value, max_discount_amount, min_order_amount, valid_until, usage_limit_total, usage_count` | `is_active=true`, `valid_from <= now`, `valid_until >= now` (anon-facing promo strips/banners) |

Consumers of `usePublicCoupons` (anon-legit reads): `HeroPromoStrip`, `MobilePromoBar`, `PromoBanner`, `CheckoutPromoReminder` (grep confirms — all display-only, they don't compute discount).

**Implication for RLS:** `usePublicCoupons` is the only anon reader. Its column list is a strict subset — an anon SELECT policy can be scoped to (a) `is_active = true AND valid_from <= now() AND valid_until >= now()` and (b) optionally a column-level grant restricted to those 9 columns. `useCoupons.ts` is admin-only and must retain full access via authenticated/admin policy.

---

## 2. Every `.from('users')` with a `role='worker'` filter (or worker-scoped)

### Anon / public booking surface
- **`src/components/InlineBookingFlow.tsx:100`** — `select('id, zip_code')` with `eq('role','worker')`, `eq('is_active', true)`. **DEAD CODE — not mounted.** Ignore for RLS scoping.
- **`src/components/EnhancedInlineBookingFlow.tsx`** — no direct `.from('users')`. Worker discovery routes through hooks/services below.

### Indirect anon paths (worker discovery during booking)
- `src/utils/zctaServiceOptimized.ts:63` — `select('id, name, city')`, `in('id', active_workers)`, `eq('role','worker')`, `eq('is_active', true)`. Called by ZCTA coverage lookups; can hit from anon booking flow.
- `src/services/zctaOnlyService.ts:312` — `select('id, name, email, phone')`, `in('id', workerIds)`, `eq('role','worker')`, `eq('is_active', true)`. **Exposes email + phone** — check whether anon calls reach here.

### Authenticated user contexts
- `src/hooks/useAuth.tsx:100` — `select('*')` `eq('id', user.id)` (self profile).
- `src/hooks/useAuth.tsx:177` — insert self profile on signup.
- `src/hooks/useBookingManager.tsx:60` — `select('id, name, email, phone')` `eq('id', booking.worker_id)`.
- `src/hooks/useBookingManager.tsx:242` — `select('id, name, email, phone')` `in('id', workerIds)`.
- `src/hooks/booking/useBookingOperations.ts:451` — update own `zip_code, city` where `id = user.id` and `zip_code is null`.
- `src/components/worker/WorkerProfileSettings.tsx:69` — worker self-update.
- `src/components/worker/WorkerCreateBookingModal.tsx:171` — insert customer row (worker action).
- `src/components/ConnectionTester.tsx:100` — self profile smoke test.

### Admin contexts (all filter `role='worker'`)
- `src/hooks/useAdminServiceAreas.ts:51` — `id, name, email, phone, is_active, created_at`.
- `src/hooks/useAdminServiceAreas.ts:181` — `id, name, email, phone, is_active`.
- `src/components/admin/WorkersManager.tsx:78` — `select('*, worker_availability(...)')` `eq('role','worker')`.
- `src/components/admin/WorkerTable.tsx:90/116/167/179/187` — activate/deactivate/delete (soft+hard).
- `src/components/admin/AddWorkerModal.tsx:84` — insert worker row.
- `src/components/admin/PendingWorkersManager.tsx:33/56/82` — list/activate/delete pending workers (`role='worker'`, `is_active=false`).
- `src/components/admin/WorkerApplicationsManager.tsx:56` — lookup by email + `role='worker'`.
- `src/components/admin/WorkerAssignmentManager.tsx:28` — `select('email, name') eq('id', workerId)`; `:107` — `select('email') eq('id', booking.customer_id)`.
- `src/components/admin/AssignWorkerModal.tsx:87` — `id, name, city, phone, email` `eq('role','worker')`, `eq('is_active', true)`; `:246` — customer email lookup.
- `src/components/admin/EditBookingModal.tsx:86` — `id, name, email, phone, city` `eq('role','worker')`, `eq('is_active', true)`.
- `src/components/admin/CreateBookingModal.tsx:80` — `id, name, email` `eq('role','worker')`, `eq('is_active', true)`.
- `src/components/admin/AdminCalendarView.tsx:71` — `id, name, email` `eq('role','worker')`, `eq('is_active', true)`.
- `src/components/admin/WorkerWeeklyPayments.tsx:69` — `id, name, email` `eq('role','worker')`; `:113` — customer name lookup `in('id', customerIds)`.
- `src/components/admin/ZctaManagementDashboard.tsx:81` — `id, name, email, phone` `eq('role','worker')`, `eq('is_active', true)`.
- `src/components/admin/SystemStatusCard.tsx:30` — `select('count')` smoke check.

### Other
- `src/utils/createTestBooking.ts:20/30` — test-fixture util (customer role).
- `src/hooks/useSupabaseQuery.tsx:49` — generic wrapper, caller-supplied `select`.

---

## Key takeaways for the RLS design (not applied yet)

- **Coupons anon policy** can safely be tightened to just active-window rows and the 9 columns `usePublicCoupons` reads. Everything else is admin/authenticated.
- **Users(role=worker) anon exposure** currently flows through `zctaServiceOptimized.ts` and `zctaOnlyService.ts` — the latter selects `email` and `phone`, which is broader than the anon booking flow needs (the flow only needs coverage availability, not contact info). Worth confirming whether these run under anon at all or only under authenticated worker/admin contexts before tightening.
- `InlineBookingFlow.tsx` is dead — its worker query does not need to be preserved by any RLS policy.

No changes will be made until you approve the RLS scope.
