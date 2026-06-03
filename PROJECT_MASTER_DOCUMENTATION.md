# PROJECT_MASTER_DOCUMENTATION.md

> **Hero TV Mounting** — Complete reverse-engineering blueprint for a multi-sided on-demand TV mounting & home-services marketplace. This document is exhaustive enough that an independent engineering team can rebuild the entire product from scratch with no access to the original source.

---

## SECTION 1 — EXECUTIVE SUMMARY

| Field | Value |
|---|---|
| **Product Name** | Hero TV Mounting |
| **Primary Domain** | https://hero-tv-mounting.lovable.app (custom: herotvmounting.com) |
| **Type** | Three-sided on-demand services marketplace (Customer ↔ Worker/Technician ↔ Admin) |
| **Industry** | Home services — TV mounting, cable management, furniture assembly, smart-home installation |
| **Core Business Problem** | Customers need vetted, scheduled, on-site TV mounting and adjacent installation services; service operators need a managed job pipeline with reliable payment authorization, capture, dispatch, and payroll. |
| **Target Audience** | (a) US residential consumers (initially Texas: Austin, San Antonio, Dallas, Fort Worth, Houston); (b) independent installation technicians; (c) operations/admin staff. |
| **User Types** | Guest, Customer (auth), Worker/Technician, Admin |
| **Revenue Model** | Service fees per booking. Stripe authorize-on-booking → capture-on-completion (with tip, add-on services, and coupon discounts). Workers paid weekly via payroll module. |
| **Value Proposition** | One-click ZIP-validated scheduling, transparent tiered pricing, authorize-now/charge-later trust model, real-time worker dispatch, SMS/email notifications, mobile-first responsive UI, and built-in admin operations console. |
| **Key Features (top level)** | Booking flow with ZIP coverage validation; tiered TV-mounting configurator; guest checkout; Stripe payment authorization + deferred capture; worker job board with accept/cancel/reschedule/reassign; add/remove services mid-job; tip collection; coupon engine; invoice generation (PDF + email); SMS notifications (Twilio A2P 10DLC compliant); admin dashboard (workers, customers, bookings, payments, coupons, services, ZCTA service-area editor, reviews, blog); payroll/weekly earnings; live/test Stripe mode toggle. |

---

## SECTION 2 — COMPLETE FEATURE INVENTORY

### 2.1 Marketing Homepage
- **Purpose:** Convert visitors into bookings.
- **User flow:** ZIP entry → service grid → cart → inline booking flow.
- **Inputs:** ZIP code.
- **Outputs:** Service availability boolean, list of available services.
- **Validation:** ZIP must exist in `us_zip_codes` AND fall inside an active worker's `worker_service_zipcodes`/ZCTA polygon.
- **Dependencies:** `useServicesData`, `useZipcodeValidation`, `ServicesCacheContext`, `localZipIndex`.
- **Edge cases:** Out-of-area ZIP → "Request coverage" CTA writing to `coverage_requests`. Stale chunk after deploy → auto-reload (`App.tsx` handler).
- **Tables:** `services`, `us_zip_codes`, `us_zcta_polygons`, `worker_service_zipcodes`.

### 2.2 Booking Flow (Inline / Modal)
- **Steps:** Service config → Schedule → Contact/Location → Payment authorization → Confirmation.
- **Inputs:** Service IDs, configuration JSON (TV size, mount type, wall type, add-ons, quantity), date/time, ZIP, address, name, email, phone, optional tip, optional coupon code.
- **Outputs:** `bookings` row (status `payment_pending` → `payment_authorized`), Stripe PaymentIntent (manual capture), reservation expiry, `booking_services` rows.
- **Validation:** Slot still available (`useWorkerAvailability`), price recalculated server-side in `payment-engine`, coupon validated via `validate-coupon`, ZIP covered, phone E.164, SMS consent checkbox required.
- **Edge cases:** Reservation expiry (`reservation_expires_at`), 3DS challenge (`requires_action`), card declined (structured `stripe_error`), guest vs authenticated, $0 total blocked (Stripe min auth).
- **Tables:** `bookings`, `booking_services`, `coupons`, `coupon_usage`, `stripe_customers`, `transactions`.
- **APIs:** `create-guest-booking`, `create-payment-intent`, `unified-payment-authorization`, `payment-engine` (action `authorize`), `validate-coupon`, `assign-authorized-booking-worker`.

### 2.3 Worker Auto-Assignment
- **Purpose:** Atomically reserve and then assign the best-fit active worker.
- **Flow:** Reservation (`reserved_worker_id` + `reservation_expires_at`) at slot selection → after successful auth, `assign-authorized-booking-worker` UPSERTs `worker_id`, sets `status='confirmed'`, sends SMS + email.
- **Edge cases:** Worker becomes inactive after reservation → fallback to next-eligible; expired reservation released by `cleanup-pending-bookings`.

### 2.4 Worker Dashboard
- **Tabs:** Jobs (today/upcoming/past), Calendar, Schedule, Service Areas, Earnings (weekly), Tips, Notifications, Profile.
- **Capabilities:** Accept payment (complete & capture), add/remove services, reschedule, reassign, cancel, collect on-site (failed auth recovery), modify invoice, change password.
- **Tables:** `bookings`, `booking_services`, `invoices`, `invoice_items`, `invoice_service_modifications`, `transactions`, `worker_availability`, `worker_schedule`, `worker_service_zipcodes`, `worker_notifications`.

### 2.5 Add/Remove Services On-Job
- **Add:** Atomic edge function `add-booking-services` → recalculates expected total → if saved card present, calls `charge-difference` (payment-engine) → updates `pending_payment_amount` and `payment_version`.
- **Remove:** `worker-remove-services` reduces base; captured-payment guard prevents negative; if booking already captured, reduction blocked.
- **Edge cases:** Guest with no saved card → `pending_payment_amount` flagged, requires manual on-site collection.

### 2.6 Complete & Capture (Worker Accepts Payment)
- **Edge function:** `worker-complete-and-capture` → `payment-engine` action `capture`.
- **Pre-capture checks:** `expectedCents <= capturableCents`; tip preserved; row-level lock via `payment_version` optimistic concurrency.
- **Post:** Status → `completed`, `captured_amount` set, `captured_at` stamped, transaction `status='captured'`, invoice generated (`enhanced-invoice-generator`), customer email + SMS dispatched.

### 2.7 Payment Recovery (Failed/Declined Auth)
- **Trigger:** `payment_status IN ('failed','cancelled')`.
- **Worker action:** "Collect Payment" → `OnSiteChargeModal` → `charge-saved-payment-method` or new Stripe Element capture.

### 2.8 Tipping
- **Capture:** Added in TipStep pre-auth, or post-completion via customer dashboard.
- **Storage:** `bookings.tip_amount`, mirrored to `transactions.tip_amount`. `tip_sync_log` audit row written.

### 2.9 Coupon Engine
- **Rules:** `discount_type` (`percent`|`fixed`), `max_discount_amount` cap, `min_order_amount`, `usage_limit_total`, `usage_limit_per_customer`, `valid_from`/`valid_until`, `city_restrictions[]`, optional service whitelist via `coupon_services`.
- **Validation:** `validate-coupon` (server-side, never client-trust).
- **Audit:** `coupon_audit_log`, `coupon_usage`.

### 2.10 Invoicing
- **Generation:** `generate-invoice` / `enhanced-invoice-generator` produce invoice + line items, store PDF in Supabase Storage, set `pdf_storage_path`, increment `invoice_sequences.last_value` per year, format `HTM-YYYY-NNNNNN`.
- **Delivery:** `send-invoice-email` via Resend; delivery state tracked in `delivery_status`, `delivery_attempts`.
- **Modifications:** logged in `invoice_service_modifications`.

### 2.11 Notifications
- **SMS:** `send-sms-notification` (worker assignment), `send-customer-sms-notification` (booking confirmation, reminders). Twilio MessagingServiceSid `MG39ef21acfa0ebcdc51`. Requires `sms_consent=true`.
- **Email:** `unified-email-dispatcher` (Resend). Templates: booking confirmation, worker assignment, invoice, payment failed, password reset, welcome.
- **In-app:** `worker_notifications` table + realtime channel.

### 2.12 Admin Panel
Full inventory in §9. Includes workers, bookings, customers, payments, invoices, coupons, services, blog, reviews, SMS/email logs, performance dashboards, Stripe mode toggle, ZCTA editor, payment-recovery tools, integrity monitors.

### 2.13 City Landing Pages (SEO)
- Routes: `/austin-tv-mounting`, `/san-antonio-tv-mounting`, `/fort-worth-tv-mounting`, `/dallas-tv-mounting`, `/houston-tv-mounting`, `/locations/:slug`.
- Per-city H1, schema.org `LocalBusiness` JSON-LD, embedded ZIP entry.

### 2.14 Testing Mode
- Admin-only switch (`TestingModeContext`) — uses Stripe test keys, bypasses certain notifications. Access guarded by `users.role='admin'`.

### 2.15 Stripe Live/Test Mode Toggle
- `app_settings.key='stripe_mode'` controls backend; `VITE_STRIPE_MODE` controls frontend. Both must match. Updating requires manual redeploy of dependent edge functions.

---

## SECTION 3 — COMPLETE PAGE INVENTORY

| Route | Component | Access | Purpose |
|---|---|---|---|
| `/` | `Index` | Public | Homepage: hero, services grid, ZIP gate, reviews, blog. |
| `/booking-success` | `BookingSuccess` | Public | Post-checkout confirmation, displays booking summary, fires confetti. |
| `/customer-dashboard` | `CustomerDashboard` | Customer auth | Booking list, invoices, saved payment methods, notifications, tip add-after, cancellation. |
| `/worker-dashboard` | `WorkerDashboard` / `WorkerDashboardWithSidebar` | Worker auth | Job board, calendar, earnings, schedule, service areas, notifications. |
| `/worker-signup` | `WorkerSignup` | Public | Tech application form → `worker_applications`. |
| `/worker-login` | `WorkerLogin` | Public | Worker-specific login. |
| `/admin` | `Admin` / `AdminDashboard` | Admin only | Operations console (15+ sub-tabs). |
| `/privacy-policy`, `/terms-of-service` | Static | Public | Legal. |
| `/locations/:slug` + city aliases | `CityPage` | Public | SEO landing per city. |
| `*` | `NotFound` | Public | 404. |

Each page contains: SEO `<Helmet>` (title <60ch, desc <160ch), responsive layout (mobile-first, breakpoints `sm 640 / md 768 / lg 1024 / xl 1280`), `Suspense` lazy-loaded for non-Index routes.

### Page-level component matrix
For brevity each row above implies the following sub-components (full inventory by directory):
- `src/components/booking/*` — 20 step components, modal flow, calendar.
- `src/components/worker/*` — 30+ components: `JobActions`, `WorkerJobCard`, `WorkerCalendar`, `OnSiteChargeModal`, etc.
- `src/components/admin/*` — 120+ components covering every admin tab.
- `src/components/ui/*` — shadcn primitives.

---

## SECTION 4 — USER JOURNEYS

### 4.1 Guest Booking → Authorized → Captured
1. Lands `/`, enters ZIP → validated against `us_zip_codes`.
2. Selects TV mount service → `TvMountingModal` → configuration.
3. `Cart` shows totals; click Book → `EnhancedInlineBookingFlow`.
4. Schedule (slot pulled from `worker_availability` minus existing bookings + reservations).
5. Contact + location entered; SMS consent checkbox required.
6. Payment step — Stripe Elements card → `unified-payment-authorization` → `payment-engine` action `authorize`.
7. On success: `bookings.status='payment_authorized'`, reservation finalized via `assign-authorized-booking-worker`; SMS + email dispatched.
8. Day of job: worker presses "Complete Job & Accept Payment" → `worker-complete-and-capture` → status `completed`, invoice generated + emailed.

### 4.2 Auth Customer Registration & Login
- Supabase Auth (email/password). Trigger creates `users` row with `role='customer'`.
- Admin role hardcoded to `admin@herotvmounting.com` / `captain@herotvmounting.com`.

### 4.3 Worker Application → Approval
- Public form posts to `worker_applications` (`status='pending'`).
- Admin approves → creates auth user, inserts into `users` (`role='worker'`), copies availability & service zips.

### 4.4 Reschedule, Reassign, Cancel
- Worker uses `RescheduleJobModal` → `worker-reschedule-booking` → updates `scheduled_date`/`scheduled_start`, sends SMS.
- `ReassignJobModal` → `worker-reassign-booking` (7-day auth check enforced; UPSERT pattern).
- `worker-cancel-booking` releases authorization (`cancel-payment-intent`) and notifies customer.

### 4.5 Add Services Mid-Job
- Worker → `AddServicesModal` → `add-booking-services` → recalculates + auto-charges diff if saved card.

### 4.6 Admin Refund
- `RefundBookingModal` → `admin-process-refund` → Stripe refund (full or partial) → `transactions.stripe_refund_id`, `refund_amount`.

### 4.7 Coupon Apply
- Code entered in `CouponSection` → `validate-coupon` returns `{valid, discount_cents, reason?}` → applied server-side at auth time.

Each journey defines success path (toast + UI state advance), failure path (toast destructive + structured error code from edge function, e.g., `WORKER_INACTIVE`, `EXPECTED_GT_CAPTURABLE`, `STRIPE_DECLINED`, `RESERVATION_EXPIRED`).

---

## SECTION 5 — UI/UX DOCUMENTATION

### 5.1 Design System
- **Theme:** Dark, Apple-like minimal.
- **Background:** `#0F172A` (slate-900). Surfaces: slate-800/700.
- **Primary accent:** `#3B82F6` (blue-500).
- **Typography:** Inter (body), Inter Tight (display). No serifs.
- **Radius:** `--radius: 0.75rem`.
- **Shadows:** layered, low-opacity, blue-tinted on focus.
- **Tokens:** all defined in `src/index.css` + `tailwind.config.ts` (HSL only); semantic: `--background`, `--foreground`, `--primary`, `--muted`, `--accent`, `--destructive`, `--card`.

### 5.2 Components (shadcn + custom)
Buttons (default/secondary/destructive/ghost/outline/link + premium gradient), Cards, Dialogs/Sheets/Drawers, Toasts (`sonner`-style), Tabs, Accordion, Dropdown Menu, Command palette, Tooltips, Calendar (`react-day-picker`), Forms (react-hook-form + zod), Tables (sortable), Skeletons.

### 5.3 States
Every interactive element implements: default / hover / focus-visible / active / disabled / loading (spinner inline) / error (red ring + helper text).

### 5.4 Layout
- Mobile-first; bottom-stick `MobilePromoBar`; top `PromoBanner`.
- Admin uses sidebar layout (`AdminSidebar` collapsible).
- Worker uses sidebar layout (`WorkerSidebar`) with top header for mobile.

### 5.5 Animation
Framer-motion for hero entrance, step transitions, success confetti (`useConfetti`).

---

## SECTION 6 — DATABASE ARCHITECTURE

(Authoritative source: §"Supabase tables" in environment context.)

### 6.1 Core Tables
- **users** — id, email, name, phone, role (`customer|worker|admin`), is_active, stripe_customer_id, city, zip_code, lat/lng.
- **bookings** — booking core; payment fields (`payment_status`, `payment_intent_id`, `authorized_amount`, `captured_amount`, `tip_amount`, `pending_payment_amount`, `payment_version`), scheduling fields (`scheduled_date`, `scheduled_start`, `local_service_*`, `start_time_utc`, `service_tz`), guest support (`guest_customer_info` jsonb, nullable `customer_id`), worker fields (`worker_id`, `reserved_worker_id`, `reservation_expires_at`, `preferred_worker_id`), modification flags (`has_modifications`, `requires_manual_payment`), coupon fields, archive fields.
- **booking_services** — line items: `service_id`, `service_name`, `base_price`, `quantity`, `configuration` jsonb.
- **services** — catalog: name, description, base_price, duration_minutes, `pricing_config` jsonb (tiered rules), `is_active`, `is_visible`, `sort_order`, `image_url`.
- **transactions** — Stripe charge mirror: amount, base_amount, tip_amount, payment_intent_id, status (`pending|authorized|captured|refunded|cancelled`), refund fields, idempotency_key.
- **stripe_customers** — link table user/email → stripe_customer_id, default PM.
- **coupons / coupon_services / coupon_usage / coupon_audit_log** — full coupon engine.
- **invoices / invoice_items / invoice_audit_log / invoice_service_modifications / invoice_sequences** — invoicing subsystem.
- **email_logs / sms_logs** — outbound dispatch audit.
- **notification_settings / admin_alerts / worker_notifications** — alerting.
- **state_tax_rates** — sales-tax matrix.
- **worker_availability / worker_schedule / worker_service_zipcodes** — dispatch data (worker side).
- **us_zip_codes / us_zcta_polygons** — geographic primitives.
- **app_settings / app_settings_audit** — runtime config (incl. `stripe_mode`).
- **admin_impersonation_sessions** — view-as-worker audit.
- **idempotency_records** — payment idempotency.
- **rls_debug_logs / service_operation_logs / service_area_audit_logs / booking_audit_log / tip_sync_log** — observability.

### 6.2 Relationships (logical FKs; not enforced at DB level per project pattern)
- `bookings.customer_id → users.id` (nullable for guests)
- `bookings.worker_id → users.id`
- `booking_services.booking_id → bookings.id`
- `booking_services.service_id → services.id`
- `invoices.booking_id → bookings.id`
- `invoice_items.invoice_id → invoices.id`
- `transactions.booking_id → bookings.id`
- `coupon_usage.coupon_id → coupons.id`, `coupon_usage.booking_id → bookings.id`
- `worker_service_zipcodes.worker_id → users.id` (named constraint required per memory)

### 6.3 Triggers
- `requires_manual_payment` auto-set on bookings when `pending_payment_amount > 0` AND no saved card.
- `payment_version` increments on every booking payment-field UPDATE (optimistic lock).
- `tip_sync_log` written on tip change.
- `invoice_audit_log` on invoice INSERT/UPDATE.

### 6.4 Functions (SECURITY DEFINER)
- `get_current_user_role()` — returns caller's role without RLS recursion.
- `has_role(uid, role)` — pattern reserved for future role split.

### 6.5 RLS Patterns
- Admin universal access via `get_current_user_role() = 'admin'`.
- Customers: own rows only (`customer_id = auth.uid()`).
- Workers: rows where `worker_id = auth.uid()`.
- Guests: anonymous SELECT allowed only on `payment_pending` bookings with NULL customer_id.

---

## SECTION 7 — API DOCUMENTATION (Edge Functions)

All functions live at `https://ggvplltpwsnvtcbpazbe.supabase.co/functions/v1/<name>`. JWT verification per `supabase/config.toml`. Public functions accept anon key.

| Function | Method | Auth | Purpose |
|---|---|---|---|
| `payment-engine` | POST | none | Central authority. Actions: `authorize`, `capture`, `charge_difference`, `finalize_3ds`, `refund`, `cancel`. |
| `unified-payment-authorization` | POST | none | Thin proxy → `payment-engine.authorize`. |
| `unified-payment-verification` | POST | none | Verify/sync PaymentIntent state. |
| `create-payment-intent` | POST | none | Initial PI creation for legacy callers. |
| `capture-payment-intent` | POST | none | Direct capture (legacy). |
| `cancel-payment-intent` | POST | none | Release authorization. |
| `charge-saved-payment-method` | POST | none | Off-session charge w/ saved PM. |
| `setup-customer-payment` | POST | none | SetupIntent to save a card. |
| `get-payment-method-details` | POST | none | Fetch saved card brand/last4. |
| `create-guest-booking` | POST | none | Insert guest booking row. |
| `create-checkout` | POST | none | Stripe Checkout fallback. |
| `add-booking-services` | POST | none | Atomic add-services + auto-charge-diff. |
| `worker-remove-services` | POST | none | Reduce services (captured guard). |
| `worker-complete-and-capture` | POST | none | Worker accepts payment. |
| `worker-cancel-booking` / `worker-reschedule-booking` / `worker-reassign-booking` | POST | none | Worker mutations. |
| `validate-coupon` | POST | none | Server-side coupon validation. |
| `generate-invoice` / `enhanced-invoice-generator` / `update-invoice` / `send-invoice-email` | POST | none | Invoice lifecycle. |
| `unified-email-dispatcher` | POST | none | Resend email gateway (requires `to`, `subject`, `html`, `email_type`). |
| `send-sms-notification` / `send-customer-sms-notification` | POST | none | Twilio dispatch. |
| `assign-authorized-booking-worker` | POST | none | Post-auth worker UPSERT. |
| `cleanup-pending-bookings` / `cleanup-unpaid-bookings` | POST | none | Cron cleanup. |
| `detect-uncaptured-payments` | POST | none | Monitor stale auths. |
| `sync-stripe-captures` / `sync-authorized-bookings` / `sync-payment-after-modification` / `async-payment-sync` | POST | none | Stripe ↔ DB reconciliation. |
| `stripe-transactions-sync` | POST | none | Backfill. |
| `admin-process-refund` | POST | JWT | Admin refund. |
| `delete-transactions` / `bulk-delete-payment-pending` / `repair-tip-calculations` / `validate-booking-integrity` | POST | JWT | Admin maintenance. |
| `import-zcta-data` / `seed-us-zip-codes` / `unified-spatial-operations` / `service-area-upsert` | POST | various | Geospatial. |
| `booking-notification-watchdog` | POST | none | Cron retry for missed notifications. |

### 7.1 Standard response envelope
```json
{ "success": true|false, "data"?: {...}, "error"?: "msg", "error_code"?: "ENUM", "stripe_error"?: {...}, "requires_action"?: true, "client_secret"?: "..." }
```
HTTP 200 even for business-logic failures (so client can branch on `success`); HTTP 4xx/5xx only for malformed requests or unhandled exceptions.

### 7.2 Authentication pattern
Edge functions validate JWT in code via `supabase.auth.getUser(token)` (never trust headers). Admin gating via `users.role = 'admin'`.

---

## SECTION 8 — AUTHENTICATION & AUTHORIZATION

- **Provider:** Supabase Auth, email/password (passwords ≥ 8, mixed-case + digit recommended).
- **Sessions:** Supabase JWT (1 h), auto-refresh refresh-token rotation.
- **Reset:** Magic-link via `auth/reset` template.
- **Admin:** Hardcoded by email (`admin@herotvmounting.com`, `captain@herotvmounting.com`) plus `users.role='admin'`.
- **Worker:** Created from `worker_applications` approval flow.
- **Customer:** Default on signup (trigger sets `role='customer'`).
- **Impersonation:** Admin-only `admin_impersonation_sessions` audit log.

### 8.1 RBAC matrix
| Capability | Guest | Customer | Worker | Admin |
|---|---|---|---|---|
| Browse services | ✅ | ✅ | ✅ | ✅ |
| Create booking | ✅ (guest) | ✅ | — | ✅ |
| View own bookings | own session | ✅ | assigned | all |
| Capture payment | — | — | own jobs | ✅ |
| Refund | — | — | — | ✅ |
| Manage services/coupons | — | — | — | ✅ |
| Manage workers | — | — | — | ✅ |
| Toggle Stripe mode | — | — | — | ✅ |

---

## SECTION 9 — ADMIN PANEL ANALYSIS

Admin (`/admin`) tabs (driven by `AdminSidebar`):
1. **Dashboard** — KPIs (revenue, bookings/day, active workers, captured vs authorized), `DashboardStats`, `PerformanceDashboard`.
2. **Bookings** — `BookingsManager`, `BookingTable`, filters (status, date, worker, payment_status), bulk actions (delete pending), `BookingIntegrityMonitor`, `BookingSmokeTest`.
3. **Workers** — `WorkersManager` + applications tab (`WorkerApplicationsManager`), Add/Edit, availability, service areas (map editor), password reset, view-as-worker, weekly payments.
4. **Customers** — `CustomersManager`, history modal, manual booking create.
5. **Payments** — `PaymentsManager`, `PaymentCaptureHistory`, `PaymentRecoveryTools`, `LivePaymentValidator`, `PricingIntegrityMonitor`, `StripeConfigStatus`, `StripeModeToggle`, `StripeSyncButton`.
6. **Invoices** — `InvoicesManager`, email verifier, manual resend, void.
7. **Coupons** — `CouponsManager`, create/edit modals, usage report.
8. **Services** — `ServicesManager` with drag-sort (`SortableServiceItem`), tiered pricing editor.
9. **Service Areas / ZCTA** — `AdminServiceAreasUnified`, polygon editor, ZIP bulk assignment.
10. **Reviews** — `ReviewsManager`.
11. **Blog** — `BlogManager`, MDX-style post modal.
12. **Notifications** — settings, SMS/email log managers, email health checks, test suites.
13. **Tips** — `TipAnalyticsDashboard`, `WorkerTipTracker`, `ManualTipCorrection`.
14. **System** — deployment panel, performance monitor, storage cache optimizer.
15. **Refunds** — `RefundBookingModal` flow.

Each tab enforces admin gate at route + RLS.

---

## SECTION 10 — BUSINESS LOGIC

### 10.1 Pricing
- Base price per service in `services.base_price`.
- Tiered pricing via `services.pricing_config` JSON (e.g., TV mounting: $90 for 32-55", $120 for 56-65", $150 for 66"+, +$30 stone wall, +$50 full-motion).
- Parsed server-side via regex (memory: "Server-side tiered pricing").
- Coupon discount applied last; capped by `max_discount_amount`.
- Sales tax via `state_tax_rates`.
- Total = subtotal − coupon_discount + tax + tip.

### 10.2 Payment Authorization Sequence
1. Compute `amount_cents` server-side (never trust client).
2. Create/lookup Stripe customer.
3. Attach PM; create PI with `capture_method='manual'`.
4. On `requires_action` → return `client_secret` for 3DS; client confirms then calls `finalize_3ds`.
5. On `succeeded` (authorized) → mark `payment_status='authorized'`, write `transactions` row, save `payment_intent_id` + `stripe_payment_method_id`.
6. Trigger worker assignment.

### 10.3 Capture
- Re-fetch PI; assert `capturable_amount >= expected`.
- If `expected > capturable` AND saved PM → call `charge_difference` for delta, re-fetch.
- `capture()` Stripe → on success: status `completed`, `payment_status='captured'`, `captured_at=now()`, generate invoice.

### 10.4 Worker Eligibility
- `verifyWorkerOrAdmin` (payment-engine lines 159–173): admin OR `booking.worker_id === userId`. **Critical regression:** if worker deactivated or role changed but `worker_id` still references them, action returns `Access denied`. Mitigation: never deactivate without first reassigning bookings.

### 10.5 Refund Rules
- Full refund only if `payment_status='captured'` AND within 30 days.
- Partial refund freeform amount, max = `captured_amount - already_refunded`.

### 10.6 Coupon Stacking
- Single coupon per booking; cannot stack.

### 10.7 Auto-archive
- `bookings.is_archived=true` set after 90 days post-completion via cron.

---

## SECTION 11 — SEARCH

- Admin global search (`GlobalSearch`) — fuzzy across bookings (id, customer email/name, phone), customers, workers.
- Booking filters (status, date range, payment status, worker) — server-side via Supabase queries (limit 1000; pagination required for >1000).
- ZIP search — local in-memory index (`localZipIndex`) for instant validation; falls back to `us_zip_codes`.

---

## SECTION 12 — REPORTING & ANALYTICS

- Admin KPIs (`useAdminMetrics`): bookings today/week/month, revenue captured, revenue authorized-not-captured, average ticket, top workers, conversion rate.
- Tip analytics (per-worker, per-week).
- Payment integrity monitor — detects authorized PIs past scheduled date.
- Performance dashboard — page load, API latencies.
- Export: CSV via `exportUtils` for bookings, payments, invoices.

---

## SECTION 13 — FILE MANAGEMENT

- Supabase Storage buckets: `invoices` (PDFs), `service-images`, `blog-images`.
- Upload: `ImageUpload` with chunked upload (`useChunkedUpload`).
- Validation: max 10MB images, max 25MB PDFs; MIME whitelisted.
- Access: invoices private (signed URLs); service/blog images public-read.

---

## SECTION 14 — NOTIFICATION SYSTEM

| Channel | Trigger | Template | Recipient | Conditions |
|---|---|---|---|---|
| Email | Booking authorized | `booking-confirmation` | customer | always |
| Email | Worker assigned | `worker-assignment` | worker | once per booking (`worker_assignment_email_sent`) |
| Email | Invoice ready | `invoice` | customer | after capture |
| Email | Payment failed | `payment-failed` | customer | on declined off-session charge |
| SMS | Booking confirmation | per template | customer | `sms_consent=true` |
| SMS | Worker assignment | per template | worker | always |
| SMS | Day-of reminder | per template | customer + worker | cron 8 a.m. local |
| In-app | Booking/assignment changes | `worker_notifications` | worker | realtime |
| Email | Welcome | `welcome` | new customer | on signup |
| Email | Password reset | Supabase Auth | any | on request |

All Twilio sends use MessagingServiceSid `MG39ef21acfa0ebcdc51` (A2P 10DLC).

---

## SECTION 15 — PAYMENT SYSTEM

- **Gateway:** Stripe (manual capture).
- **Modes:** test/live toggled by `STRIPE_MODE` (edge) + `VITE_STRIPE_MODE` (frontend); keys must use `sk_test_`/`sk_live_` prefix; updating Supabase secrets requires manual edge-function redeploy.
- **Authorize → Capture window:** up to 7 days (Stripe default).
- **3DS / SCA:** `requires_action` returned → client `stripe.confirmCardPayment` → `finalize_3ds` action.
- **Webhooks:** Stripe webhook ingestion at `stripe-webhook` (if enabled) updates `transactions`. Otherwise `async-payment-sync` polled.
- **Refunds:** `admin-process-refund` → Stripe refund → store id in `transactions`.
- **Subscription:** none.
- **Failed payment:** Surface to worker via `PaymentRecoveryAlert`; "Collect Payment" recharges.
- **Constraints:** $0 authorizations blocked by Stripe (memory: 100% discount issue → minimum $0.50 enforced).

---

## SECTION 16 — PERFORMANCE

- React Query cache: 5-min staleTime, 30-min gcTime.
- Code split: only `Index` eager; all other routes `lazy()` + `Suspense`.
- Prefetch booking flow bundle on cart-add (memory: `prefetch-optimization`).
- Image lazy loading; service images cached in local storage with fallbacks (memory: service-loading-resilience).
- ZIP index preloaded on idle.
- Stale-chunk handler auto-reload after deploys.
- Supabase queries hard-capped to 1000 rows; admin tables paginate.

---

## SECTION 17 — SECURITY AUDIT

| Risk | Mitigation |
|---|---|
| Privilege escalation via client-side role | Roles only in DB; SECURITY DEFINER `get_current_user_role`. |
| Service-role key exposure | Never sent to client; only `Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')` server-side. |
| RLS recursion | `get_current_user_role()` SECURITY DEFINER bypasses recursion. |
| Stripe webhook spoofing | Signature verification with `STRIPE_WEBHOOK_SECRET`. |
| Idempotency replay | `idempotency_records` + Stripe idempotency keys on PI/refund creation. |
| SMS abuse | Explicit `sms_consent`; MessagingServiceSid restricted to verified A2P campaign. |
| XSS | React escapes by default; no `dangerouslySetInnerHTML` outside sanitized blog. |
| CSRF | Token-based auth (JWT in Authorization header), not cookies; SameSite=Lax on Supabase cookie. |
| SQL injection | All queries via Supabase JS client (parameterized) or pg-typed RPC. |
| Coupon tampering | Server-side `validate-coupon`; price recomputed server-side at auth. |
| Guest booking abuse | Rate-limit by IP, captcha on signup, reservation TTL. |
| Headers | `useSecurityHeaders` applies CSP, HSTS, X-Frame-Options=DENY, X-Content-Type-Options=nosniff, Referrer-Policy. |

---

## SECTION 18 — MOBILE RESPONSIVENESS

- Tailwind breakpoints `sm 640 / md 768 / lg 1024 / xl 1280 / 2xl 1536`.
- Mobile: bottom promo bar; single-column; hamburger nav.
- Tablet: 2-column grid for services; collapsible sidebar.
- Desktop: 3–4 col grid; persistent sidebars on admin/worker.
- Capacitor wrappers for iOS/Android (`capacitor.config.ts`).

---

## SECTION 19 — THIRD-PARTY INTEGRATIONS

| Service | Purpose | Data flow | Key |
|---|---|---|---|
| **Supabase** | DB, Auth, Storage, Edge Functions | All app data | `SUPABASE_URL` + anon + service-role |
| **Stripe** | Payments | Authorize/capture/refund/PMs | `STRIPE_SECRET_KEY` (sk_live/sk_test) + `VITE_STRIPE_PUBLIC_KEY` + `STRIPE_WEBHOOK_SECRET` |
| **Twilio** | SMS (A2P 10DLC) | Outbound transactional | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_MESSAGING_SERVICE_SID=MG39ef21acfa0ebcdc51` |
| **Resend** | Email | Transactional + auth | `RESEND_API_KEY` |
| **Lovable AI Gateway / Lovable Cloud** | Hosted Supabase | — | auto |
| **Leaflet + ZCTA polygons** | Maps in admin | client | — |

---

## SECTION 20 — STATE MANAGEMENT

- **Global:** `AuthProvider`, `TestingModeContext`, `ServicesCacheContext`, React Query `QueryClient`, `HelmetProvider`.
- **Server cache:** React Query (5-min stale).
- **Local component:** `useState`/`useReducer`.
- **Session:** `sessionStorage` (booking flow restore) — with validation guards before restore (memory: session-restoration-guard).
- **Persistent client:** `localStorage` (services cache, ZIP index, tour-seen, stale-chunk flag).
- **Realtime:** Supabase channels for `bookings`, `worker_availability`, `worker_schedule`, `worker_notifications`, `invoices`.

---

## SECTION 21 — COMPLETE REBUILD PLAN

### 21.1 Frontend
- **Stack:** React 18 + Vite 5 + TypeScript 5 + Tailwind v3 + shadcn/ui + Radix + framer-motion + React Query + react-hook-form + zod + react-helmet-async + Leaflet.
- **Folder structure:** `src/{components,pages,hooks,contexts,integrations,utils,services,constants,types,assets}` — feature-grouped within `components/{admin,worker,booking,payment,checkout,customer,ui,...}`.
- **State:** Query for server data, Context for cross-cutting, local state otherwise.

### 21.2 Backend
- **Supabase** Postgres + RLS + Edge Functions (Deno).
- **Single source of truth: `payment-engine`** for any Stripe op.
- Thin proxy functions for legacy callers.
- Cron via Supabase scheduled functions for cleanup/watchdog/sync.

### 21.3 Database
- ~40 tables (per §6). PostGIS extension for `us_zcta_polygons` (geom). All `public.*` tables require explicit GRANTs per project rule.

### 21.4 Deployment
- Hosting: Lovable (Vite static) + Supabase (managed).
- CI: GitHub Actions (`.github/workflows/ci.yml` + clone-detection).
- Monitoring: `admin_alerts` table + admin dashboards.
- Mobile: Capacitor build pipeline for iOS/Android.

---

## SECTION 22 — DEVELOPMENT ESTIMATION

| Workstream | Hours |
|---|---|
| UI/UX design system | 80 |
| Frontend (marketing + booking + customer + worker + admin) | 900 |
| Backend (40+ edge functions) | 500 |
| Database (schema, RLS, triggers, migrations) | 160 |
| Stripe + Twilio + Resend integrations | 160 |
| Geospatial (ZCTA import, polygon editor) | 120 |
| QA + e2e (Playwright) | 200 |
| DevOps + CI/CD + monitoring | 80 |
| **Total** | **~2,200 hrs** |

- **MVP timeline (single-city, no coupons, no admin polish):** 10–12 weeks (3 engineers).
- **Production parity:** 6 months (4 FE + 2 BE + 1 designer + 1 QA).
- **Team size:** 6–8 incl. PM.

---

## SECTION 23 — QA TEST CASES (representative)

| ID | Scenario | Steps | Expected | Priority |
|---|---|---|---|---|
| TC-001 | ZIP in coverage | Enter "78701" | Services grid loads | P0 |
| TC-002 | ZIP out of coverage | Enter "99999" | "Request coverage" CTA | P1 |
| TC-003 | Guest auth + capture | Book → auth card → worker captures | `payment_status=captured`, invoice emailed | P0 |
| TC-004 | 3DS card | Use 4000002500003155 | `requires_action` → confirm → `authorized` | P0 |
| TC-005 | Declined card | 4000000000000002 | Toast w/ Stripe decline reason | P0 |
| TC-006 | Add service mid-job (saved card) | Worker adds $25 | Auto-charge diff, capturable updated | P0 |
| TC-007 | Add service (guest no card) | Worker adds $25 | `pending_payment_amount=25`, requires manual collect | P1 |
| TC-008 | Remove service after capture | Worker removes line | Blocked w/ toast | P1 |
| TC-009 | Coupon valid | Apply WELCOME10 | 10% discount, capped | P0 |
| TC-010 | Coupon expired | Apply expired | "Coupon expired" toast | P1 |
| TC-011 | Worker inactive | Try capture | `WORKER_INACTIVE` error | P0 |
| TC-012 | Reservation expired | Wait 15 min on payment step | Slot released, must reselect | P1 |
| TC-013 | Reschedule | Worker reschedules +1 day | SMS sent both parties | P1 |
| TC-014 | Reassign within 7 days | Admin reassigns | UPSERT succeeds | P1 |
| TC-015 | Refund partial | Admin refunds $30 of $100 | Stripe refund + `refund_amount` | P1 |
| TC-016 | Stripe mode mismatch | Frontend live, backend test | Auth fails with clear error | P0 |
| TC-017 | RLS — customer reads other's booking | Direct query | Returns empty | P0 |
| TC-018 | Admin RLS — read all | Admin lists bookings | All rows returned | P0 |
| TC-019 | SMS without consent | Book without checking consent | Booking blocked | P0 |
| TC-020 | Invoice PDF | Capture | PDF stored, URL signed | P0 |

(Multiply across all features for ~250 cases total.)

---

## SECTION 24 — PRODUCT IMPROVEMENTS

**High impact**
- Server-side strict typecheck on every edge-function payload via zod.
- Replace hardcoded admin email with `user_roles` table per security best practice.
- Webhook-driven Stripe sync rather than polling (`async-payment-sync`).
- Mandatory worker-reassignment guard before deactivation (eliminates the historical "Connor" regression).
- Multi-coupon stacking + referral codes.

**Medium impact**
- Customer mobile app (Capacitor already wired).
- Live chat between worker and customer.
- Smart routing using travel-time, not just ZIP overlap.
- Native push notifications.

**Low impact**
- Dark/light theme toggle.
- Multi-language (es-MX).
- Loyalty points.

---

## SECTION 25 — FINAL SYSTEM BLUEPRINT

```
┌────────────────────────────────────────────────────────────────────┐
│                           CLIENT (React/Vite)                       │
│  Marketing │ Booking Flow │ Customer Dash │ Worker Dash │ Admin    │
│             ↑ React Query │ Realtime channels │ Stripe.js          │
└──────────────────────────────┬─────────────────────────────────────┘
                               │ HTTPS (anon JWT)
┌──────────────────────────────▼─────────────────────────────────────┐
│                       SUPABASE EDGE FUNCTIONS (Deno)                │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │              PAYMENT-ENGINE (sole Stripe authority)           │  │
│  │  authorize · capture · charge_difference · refund · cancel    │  │
│  └─────────────┬───────────────────────────┬────────────────────┘  │
│  Proxy fns ────┘                Worker/Admin fns ─────┘            │
│  Email/SMS dispatchers │ Invoice generator │ Cron watchdogs        │
└──────────────────────────────┬─────────────────────────────────────┘
                               │
        ┌──────────────────────┼──────────────────────┐
        ▼                      ▼                      ▼
┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│  POSTGRES    │       │   STRIPE     │       │ TWILIO/RESEND│
│  + RLS       │       │  (live/test) │       │              │
│  + PostGIS   │       │              │       │              │
│  + Storage   │       └──────────────┘       └──────────────┘
└──────────────┘
```

- **Feature map** — §2 (15 feature groups).
- **Database map** — §6 (40 tables; logical relationships listed).
- **API map** — §7 (50+ edge functions; payment-engine central).
- **User flow map** — §4 (7 primary journeys).
- **Admin flow map** — §9 (15 admin tabs).
- **Deployment** — Lovable static FE + Supabase managed backend + Stripe/Twilio/Resend SaaS + Capacitor for native shells.

— **END OF DOCUMENT** —
