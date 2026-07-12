
# Flowchart vs. Codebase Cross-Check (read-only)

Each item marked **MATCHES / PARTIALLY MATCHES / DOES NOT EXIST YET** with file evidence.

---

### 1. Entry / Auth — **PARTIALLY MATCHES**
- `src/components/auth/AuthModal.tsx` has both **login** and **signup** tabs (single modal used from `Header.tsx` for customers).
- Workers have a **separate** login surface: `src/pages/WorkerLogin.tsx` + `src/components/worker/WorkerLoginForm.tsx`. Worker signup is `src/pages/WorkerSignup.tsx` (via worker applications).
- Admin has its own gate: `src/components/admin/AdminLogin.tsx` inside `src/pages/Admin.tsx` (no signup — role must be pre-set).
- Role-based redirect: **not implemented in a single place**. `AuthModal` just closes; role-appropriate dashboard link then appears in `Header.tsx` based on `profile.role`. Only `WorkerLogin.tsx` has an explicit `navigate('/worker-dashboard')` on auth. `Admin.tsx` gates by `profile.role !== 'admin'` in-page.
- Mismatch to document: there is **no unified post-login role router** — behavior is per-page.

---

### 2. Booking flow step order — **DOES NOT MATCH DOCUMENTED ORDER**
Actual order in `src/components/EnhancedInlineBookingFlow.tsx` (lines 440–570), 5 steps:
1. **Service Configuration** (`ServiceConfigurationStep`)
2. **Contact & Location** — name/email/phone **and** zipcode (`ContactLocationStep`) + coupon section
3. **Schedule** (`ScheduleStep`)
4. **Tip** (`TipStep`)
5. **Payment Authorization** (`PaymentAuthorizationForm`)

Documented order was `zip → services → schedule → details → payment`. Real order is `services → contact+zip → schedule → tip → payment`. Zip is captured **inside** the contact step, not first; there is a dedicated **Tip** step before payment that the flowchart omits.

---

### 3. Zip / Geo assignment — **MATCHES (both tables live-wired)**
Live assignment path: `supabase/functions/assign-authorized-booking-worker/index.ts` calls RPC `find_available_workers_by_zip`. Function body (verified via `pg_get_functiondef`) does:
```
INNER JOIN worker_service_zipcodes wsz ON u.id = wsz.worker_id
INNER JOIN worker_service_areas   wsa ON wsz.service_area_id = wsa.id
WHERE wsa.is_active = true AND wsz.zipcode = p_zipcode
```
So both tables are required at match time: `worker_service_areas` gates activation of an area, `worker_service_zipcodes` provides the flat zip lookup. Neither is dead. `service-area-upsert` writes both on save.

---

### 4. Worker dashboard tabs/actions — **PARTIALLY MATCHES**
Tabs (`src/pages/WorkerDashboard.tsx` lines 371–374):
- My Jobs, Calendar, Set Schedule, Service Area. (4 tabs, no separate "Earnings" tab at the top level — earnings surface inside job cards.)

Per-job actions in `src/components/worker/JobActions.tsx`:
- ✅ **Call customer**
- ✅ **Complete Job & Accept Payment** (single button = mark complete + capture)
- ✅ **Charge / OnSiteChargeModal** (`onChargeClick`)
- ✅ **Add Services** (`AddServicesModal`)
- ✅ **Modify / Remove Services** (`RemoveServicesModal`)
- ✅ **Reassign** (`ReassignJobModal`), **Reschedule** (`RescheduleJobModal`)
- ✅ **Archive**
- ❌ "Capture payment" as a *separate* action from completion does **not** exist — it is fused into "Complete Job & Accept Payment".
- Service-area editing is a **top-level tab**, not a per-job action (correct).

---

### 5. Worker Map / propose-approve staging — **PARTIALLY MATCHES**
- A worker-facing map editor **does exist**: `src/components/worker/service-area/ServiceAreaMap.tsx` using **Leaflet + leaflet-draw + concaveman** (not Mapbox — `rg mapbox` returns nothing anywhere). Also `ServiceAreaSettings.tsx`, `ZipCodeTester.tsx` in the same folder.
- **No propose/approve staging workflow exists.** No `propose`/`approval` strings in the worker service-area code or `useWorkerServiceAreas.ts`; saves go directly through `service-area-upsert` edge fn which writes to `worker_service_areas` + `worker_service_zipcodes` live. Your flag that staging is "not yet built" is correct; the map itself IS built.

---

### 6. Admin tabs — **PARTIALLY MATCHES**
Actual tabs in `src/pages/Admin.tsx` switch (lines 121–170):
`dashboard, bookings, customers, workers, services, reviews, payments, invoices, coupons, sms, email, blog, coverage/service-areas, tips, payroll, settings` (+ hidden: `invoice-monitoring`, `email-notifications` redirect to dashboard).

Vs. your assumed list (Bookings/Services/Workers/Customers/Coupons/Payments/Monitoring):
- ✅ Bookings, Services, Workers, Customers, Coupons, Payments — all real.
- ❌ **Monitoring** — no tab by that name. Nearest equivalents live inside other tabs (`BookingIntegrityMonitor`, `PaymentPerformanceMonitor`, `ServiceOperationsMonitor`, `SpatialHealthDashboard`) but are not top-level.
- ➕ Not in your doc: **Reviews, Invoices, SMS logs, Email logs, Blog, Service Areas/Coverage, Tips, Payroll, Settings, Dashboard (stats home)**.

There is a second, apparently unused surface `src/pages/AdminDashboard.tsx` with only 4 tabs (spatial/tips/areas/analytics) — the real entry route `/admin` uses `Admin.tsx`.

---

### 7. Coupon system UI — **MATCHES**
Full admin UI exists: `src/components/admin/CouponsManager.tsx`, `CreateCouponModal.tsx`, `EditCouponModal.tsx`, `CouponUsageModal.tsx`; wired to the `coupons` tab in `Admin.tsx`. Validation on checkout via `supabase/functions/validate-coupon` and `CouponSection` inside the booking flow.

---

### 8. Tips / Stripe Connect — **DOES NOT EXIST YET (for Connect)**
`rg 'stripe.accounts|stripe.transfers|transfer_data|application_fee|connected_account|acct_' src supabase/functions` returns **zero hits**. `rg -i mapbox|connect` shows no Stripe Connect code anywhere.
Tips are handled entirely internally: `tip_amount` column on bookings, `tip_sync_log` table, `WorkerTipTracker.tsx`, `TipAnalyticsDashboard.tsx`, `WorkerTipsHistory.tsx`, `repair-tip-calculations` fn, plus `WorkerWeeklyPayments` payroll view. No connected accounts; payouts are ledger-only.

---

### 9. Notification dispatcher — **MATCHES**
Confirmed the two mechanisms and their triggers:
- **Email**: `supabase/functions/unified-email-dispatcher` (called with `emailType` discriminator).
- **SMS**: `supabase/functions/send-sms-notification` (worker) and `send-customer-sms-notification` (customer). Also `send-increment-notification`.

Actual invocation sites (grep of `functions.invoke('unified-email-dispatcher'|'send-*sms-notification')`):
- `assign-authorized-booking-worker` → worker_assignment email + worker SMS + customer SMS + booking_confirmation email (post-assignment).
- `worker-reschedule-booking`, `worker-reassign-booking`, `worker-cancel-booking` → email dispatcher.
- `generate-invoice` → email dispatcher.
- `admin-process-refund` → email dispatcher.
- `AssignWorkerModal.tsx` (admin manual assign) → email dispatcher (×2 for worker + customer).
- Standalone: `send-customer-booking-confirmation-email`, `send-invoice-email`, `send-worker-assignment-notification` also exist; the codebase has migrated most call-sites to the unified dispatcher but these older direct functions remain deployed.

---

## Overall verdicts
| # | Module | Verdict |
|---|---|---|
| 1 | Entry/Auth | Partial — three separate login surfaces, no unified role router |
| 2 | Booking step order | **Wrong** — real order includes a Tip step, zip is in contact step |
| 3 | Zip/Geo (both tables) | Matches — both tables required by `find_available_workers_by_zip` |
| 4 | Worker dashboard | Partial — 4 tabs; complete+capture is one fused button |
| 5 | Worker map / staging | Partial — Leaflet map exists; propose/approve staging does **not** |
| 6 | Admin tabs | Partial — 6 of your 7 exist, no "Monitoring" tab, 9 extra tabs undocumented |
| 7 | Coupons UI | Matches — full CRUD + usage modal |
| 8 | Stripe Connect for tips | Does not exist — tips are internal ledger only |
| 9 | Notification dispatcher | Matches — unified-email-dispatcher + SMS fns, triggered by assignment/reschedule/reassign/cancel/refund/invoice |

No files changed. Approve to proceed with any follow-up (e.g., updating your flowchart doc) or ask for deeper drill-down on any row.
