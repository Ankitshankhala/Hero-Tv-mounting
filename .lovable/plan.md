# Hero TV Mounting — Rebuild Inventory

Plan-mode deliverable. No code changes proposed; this is a report.

## 1. Documentation summaries

### `PROJECT_MASTER_DOCUMENTATION.md`
Canonical feature inventory. **Feature areas covered:** marketing homepage, inline/modal booking flow, worker auto-assignment (reservation → assign UPSERT), worker dashboard (jobs / calendar / schedule / service areas / earnings / tips / notifications / profile), add/remove services on-job with tiered payment recalculation, complete-and-capture flow (single `payment-engine` capture action, invoice + email/SMS dispatch), payment recovery for failed auths (`OnSiteChargeModal`), tipping (pre-auth or post-completion, `tip_sync_log` audit), coupon engine (percent/fixed, min order, per-customer cap, city restrictions), invoicing (`HTM-YYYY-NNNNNN` numbering, PDF in Supabase Storage, Resend delivery), notifications (Twilio SMS + Resend email + realtime `worker_notifications`), admin panel, five city landing pages, admin-only testing mode (`TestingModeContext`), Stripe live/test toggle via `app_settings.stripe_mode` + `VITE_STRIPE_MODE`. Auth: Supabase email/password, trigger seeds `users` with `role='customer'`. Admin role hardcoded to `admin@herotvmounting.com` / `captain@herotvmounting.com`. Worker approval flow via `worker_applications`.

### `PRD_Hero_TV_Mounting.md`
Business PRD. Product = residential TV mounting/home services in Texas. Personas: customer, worker, admin. KPIs: 4.5★ rating, 70% booking completion, 20% faster job completion, 25% YoY revenue, expand to 5+ metros. Non-functional targets: 4.5★ rating, transparent tiered pricing, mobile-friendly worker UI.

### `docs/PRICING_ARCHITECTURE.md`
**Single-source-of-truth rule:** `services.pricing_config.add_ons.<key>` must equal the `base_price` of the corresponding standalone add-on service row. Enforced by a Postgres trigger `validate_pricing_consistency()` that logs mismatches to `admin_alerts`. Central utils: `src/utils/pricingEngine.ts` (`getAddOnPrice`, `getTierPrice`, `calculateTvMountingTotal`, `validateAllPricing`) and `src/utils/pricingDisplay.ts`. Historical issues: hardcoded fallbacks in UI causing drift — resolved by removing all fallback constants. (Notably, this doc predates the tiered `pricing_config.tiers` support we just fixed in `add-booking-services` and `AddServicesModal`.)

### `SCHEDULING_UNIFICATION_SUMMARY.md`
Unified worker availability. Added unique indexes on `worker_availability (worker_id, day_of_week)` and `worker_schedule (worker_id, work_date)`, validation triggers for time ranges, `SECURITY DEFINER` RPCs `set_worker_weekly_availability`, `get_worker_weekly_availability`, `import_application_availability`, `backfill_worker_availability_from_applications`. Worker applications keep availability as JSON; approval imports into normalized tables; customer booking reads via `get_available_time_slots`.

### `docs/SERVICE_OPERATIONS_GUIDE.md`
Add/remove services subsystem. **Front:** `AddServicesModal`, `ServiceOperationsMonitor` (admin), `OperationQueueIndicator`. **Hooks:** `useRealTimeInvoiceOperations`, `useOperationQueue`, `useServiceOperationTracking`. **Utils:** `serviceValidation`, `servicesMonitoring`, `logger`. **Edge:** `add-booking-services`. **Storage:** `booking_services`, `service_operation_logs`, view `v_service_operation_analytics`. Features: duplicate prevention (unique index + upsert trigger), optimistic UI, operation queue, comprehensive validation, realtime updates, logging.

### `docs/WORKER_TRAINING_GUIDE.md`
End-user documentation for workers using the Add Services modal. Notable rules: system auto-prevents duplicates by folding into existing row's quantity; validates payment_status before allowing add; requires `payment_authorized` (not `captured`).

### `BOOKING_VALIDATION_IMPLEMENTATION.md`
Six-phase validation stack: (1) DB trigger `validate_booking_has_coverage` blocks insert without active worker ZIP coverage; (2) real-time slot availability via `useZctaWorkerAvailability` + `get_available_time_slots`; (3) post-authorization auto-assignment with fallback to `pending / requires_manual_payment` and admin alert; (4) DB constraints; (5) UI alerts (green covered / red uncovered, worker count); (6) admin override path.

### `ADD_SERVICES_COMPLETE_IMPLEMENTATION.md`
Race-condition remediation retrospective. Introduced unique index `booking_services (booking_id, service_id, configuration::text)` with a trigger that folds duplicates into quantity increments. Established payment-engine as the sole Stripe authority. Added idempotency, structured error codes, optimistic UI, and a test suite (unit + integration + E2E).

### `docs/PRICING_FIX_TESTING_GUIDE.md`
Ten test cases covering Mount TV configurations (Over 65", Frame, Special Wall combos), multi-TV pricing, DB integrity checks, admin monitor, price-mismatch alerts, auto-sync trigger, and historical booking validation. Reference add-on prices: Over 65" $25, Frame $40, Brick/Steel/Concrete $40, Soundbar $40.

### `docs/KNOWN_LIMITATIONS.md`
See §7 below — extracted verbatim.

## 2. Supabase schema (public)

RLS is enabled on every table except `invoice_sequences` and `spatial_ref_sys`. Policy pattern per table category (owner-scoped, role-scoped, or public).

**Core booking/service:**
- `bookings` (44 cols) — customer_id, worker_id (FK users), service_id (FK services), scheduled_date/start, `status` enum, payment fields (`payment_intent_id`, `payment_status`, `authorized_amount`, `captured_amount`, `payment_version` for optimistic concurrency, `pending_payment_amount`, `last_payment_intent_id`, `tip_amount`), reservation (`reserved_worker_id`, `reservation_expires_at`), coupon (`coupon_id`, `coupon_code`, `coupon_discount`, `subtotal_before_discount`), timezone/utc columns, `has_modifications`, `requires_manual_payment`, `stripe_customer_id`, `stripe_payment_method_id`, guest info JSON, archived flags, email/SMS flags. **9 policies** (owner + worker + admin + service_role).
- `booking_services` — booking_id, service_id, service_name, base_price (numeric), quantity (int), configuration (jsonb). Unique index `(booking_id, service_id, configuration::text)`. **5 policies.**
- `services` — name, description, base_price, duration_minutes, is_active, is_visible, sort_order, image_url, `pricing_config` jsonb (tiers + add_ons). **2 policies** (public read of active+visible; admin write).
- `booking_audit_log` — every mutation on bookings.
- `service_operation_logs` — analytics for add/remove ops.
- `invoice_service_modifications` — modifications during job.

**Users/workers:**
- `users` — id (FK auth.users), email, name, phone, city, zip_code, lat/lng, `role` enum (customer/worker/admin), is_active, `stripe_customer_id`, `stripe_default_payment_method_id`, `has_saved_card`. **11 policies** (self, worker, admin views, service_role).
- `worker_applications` — public submission form fields, `status` (pending/approved/rejected). **4 policies.**
- `worker_availability` — recurring weekly (worker_id, day_of_week, start_time, end_time). Unique (worker_id, day_of_week). **5 policies.**
- `worker_schedule` — per-date overrides (work_date, is_available, start/end). Unique (worker_id, work_date). **3 policies.**
- `worker_service_areas` — worker-drawn polygons (geom, area_name).
- `worker_service_zipcodes` — normalized zip list per worker; joined from polygons or manual.
- `worker_coverage_overlays` — cached geom overlays.
- `worker_coverage_notifications` — coverage-request routing.
- `worker_bookings` — assignment record with ack workflow (`ack_status`, `ack_deadline`, `ack_at`).
- `worker_notifications` — in-app notification feed.
- `admin_impersonation_sessions` — audit of admin-as-worker sessions.

**Payments/invoicing:**
- `transactions` — booking_id, amount, base_amount, tip_amount, currency, payment_method, `status` enum, payment_intent_id, `transaction_type`, capture/cancel/refund fields, `idempotency_key`.
- `tip_sync_log` — reconciliation of tip splits.
- `stripe_customers` — user_id ↔ stripe_customer_id + default PM.
- `invoices` — invoice_number, customer_id, amount, tax_amount, total_amount, state_code/tax_rate, pdf_url + pdf_storage_path, delivery_status/attempts, void fields.
- `invoice_items`, `invoice_audit_log`, `invoice_sequences` (RLS OFF — server-only counter).
- `state_tax_rates` — state_code, tax_rate.

**Coupons:**
- `coupons` — code, discount_type/value, max_discount_amount, min_order_amount, valid_from/until, usage limits, city_restrictions (text[]), is_active.
- `coupon_services` — service whitelist per coupon.
- `coupon_usage` — booking_id, customer_email, discount_amount, order_total, IP/UA audit.
- `coupon_audit_log`.

**Notifications/settings:**
- `sms_logs`, `email_logs`, `notification_settings`, `admin_alerts` (severity, alert_type, resolved fields), `app_settings` (`stripe_mode`), `app_settings_audit`.
- `idempotency_records` — request-hash dedupe.
- `rls_debug_logs` — RLS diagnostic capture.
- `service_area_audit_logs`.

**Geo/coverage (RLS on but effectively public read):**
- `us_zip_codes` (zipcode, city, state, lat, lng).
- `us_zcta_polygons` (zcta5ce, geom PostGIS, land/water area).
- `zcta_import_state` (state_abbr progress checkpoints for the importer).

**Views (materialized reporting):**
- `v_booking_payment_status_monitor`
- `v_booking_status_inconsistencies`
- `v_bookings_integrity_issues`
- `v_invoice_payment_reconciliation`
- `v_missing_transactions`
- `v_service_operation_analytics`
- `v_sms_delivery_stats`
- `zip_coverage_summary` (materialized) — worker_count, service_area_count, has_active_coverage.

**General policy patterns observed:**
- User-owned tables (users, bookings, invoices, worker_notifications): `auth.uid() = <owner_id>` for owner + `has_role('admin')` for admin + `service_role` bypass.
- Worker-owned tables (worker_availability/schedule/service_areas/zipcodes/bookings): worker sees own rows via `worker_id = auth.uid()`.
- Public tables (services active/visible, us_zip_codes, us_zcta_polygons): `TO anon` read.
- Audit tables: insert allowed to writers; read admin-only.
- All roles are stored in `users.role` (single-column enum) — **not** in the recommended separate `user_roles` table.

## 3. Edge functions (52 total under `supabase/functions/`)

**Payment core (single-authority pattern):**
- `payment-engine` — the ONLY function permitted to call Stripe PI create/cancel/capture/update. Actions: `authorize`, `recalculate`, `charge-difference`, `capture`, `complete-and-capture`, `cancel`, `refund`. Optimistic concurrency via `payment_version`. Emits `Authorization required` when no JWT.
- `unified-payment-authorization` — thin proxy → `payment-engine authorize`.
- `unified-payment-verification` — status resolver.
- `capture-payment-intent` — proxy → `payment-engine capture` (rejects mismatched totals).
- `charge-saved-payment-method` — proxy → `payment-engine charge-difference`.
- `cancel-payment-intent` — proxy → `payment-engine cancel`.
- `create-payment-intent` / `confirm-payment` — legacy entry points still used by inline flow; call `payment-engine`.
- `setup-customer-payment` — SetupIntent for saving cards.
- `get-payment-method-details` — Stripe PM display.
- `sync-payment-after-modification` — proxy → `payment-engine recalculate`.
- `worker-complete-and-capture` — worker-side capture entry → `payment-engine complete-and-capture`.
- `admin-process-refund` — admin refund entry → `payment-engine refund`.
- `async-payment-sync` — background verifier that reconciles Stripe status after auth.
- `unified-payment-authorization` — thin wrapper (see above).
- `sync-authorized-bookings` — batch retry of stuck authorizations.
- `sync-stripe-captures` — reconcile captured PIs into `transactions`.
- `stripe-transactions-sync` — pull recent charges into `transactions`.
- `detect-uncaptured-payments` — daily cron; alerts on authorized-past-service-date bookings.

**Booking lifecycle:**
- `create-guest-booking` — guest booking insert + reservation.
- `create-checkout` — checkout/reservation orchestration.
- `add-booking-services` — service add + tiered price (delegates to `payment-engine`).
- `worker-remove-services` — service remove + `payment-engine`.
- `worker-cancel-booking` — cancel + `cancel-payment-intent`.
- `worker-reschedule-booking` — reschedule + SMS.
- `worker-reassign-booking` — reassign with 7-day auth check + UPSERT.
- `worker-operations` — aggregate worker CRUD utility.
- `assign-authorized-booking-worker` — post-auth worker UPSERT + SMS + email.
- `validate-booking-integrity` — reconciliation checks.
- `cleanup-pending-bookings` — release expired reservations.
- `cleanup-unpaid-bookings` — purge stale payment_pending bookings.
- `bulk-delete-payment-pending` — admin bulk cleanup.

**Coupons & pricing:**
- `validate-coupon` — server-side coupon validation.
- `repair-tip-calculations` — one-shot tip fix utility.

**Invoicing:**
- `generate-invoice`, `enhanced-invoice-generator`, `update-invoice`, `send-invoice-email` (Resend).

**Notifications:**
- `unified-email-dispatcher` — Resend email hub; templated types.
- `send-customer-booking-confirmation-email`, `send-worker-assignment-notification`, `send-increment-notification` — specific email flows.
- `send-sms-notification`, `send-customer-sms-notification` — Twilio.
- `booking-notification-watchdog` — cron; ensures confirmation email dispatched.

**Coverage & geo:**
- `import-zcta-data` — iterate US states, fetch OpenDataDE ZCTA GeoJSON, batch-insert to `us_zcta_polygons`, checkpoint in `zcta_import_state`.
- `seed-us-zip-codes` — CSV import of zip centroids.
- `unified-spatial-operations` — polygon intersect / zip-in-area queries.
- `service-area-upsert` — worker polygon + derived zipcodes upsert.

**Admin/misc:**
- `delete-transactions`, `update-transaction-status`.
- `mcp` — auto-generated MCP server (list_services + check_service_area).

## 4. Frontend route map (`src/App.tsx`)

React Router v6, top-level lazy chunks except `Index` (eager).

| Path | Component | Owns |
|---|---|---|
| `/` | `pages/Index.tsx` | Marketing home + inline booking |
| `/booking-success` | `pages/BookingSuccess.tsx` | Post-checkout receipt |
| `/customer-dashboard` | `pages/CustomerDashboard.tsx` | Customer bookings, payments, tips |
| `/worker-dashboard` | `pages/WorkerDashboard.tsx` | Worker jobs + tabs; alt `WorkerDashboardWithSidebar.tsx` also exists |
| `/worker-signup` | `pages/WorkerSignup.tsx` | Public worker application form |
| `/worker-login` | `pages/WorkerLogin.tsx` | Worker auth |
| `/admin` | `pages/Admin.tsx` | Admin panel wrapper (renders `AdminDashboard.tsx` after role gate) |
| `/privacy-policy` | `pages/PrivacyPolicy.tsx` | Static |
| `/terms-of-service` | `pages/TermsOfService.tsx` | Static |
| `/locations/:slug` | `pages/cities/CityPage.tsx` | SEO city landing |
| `/austin-tv-mounting`, `/san-antonio-tv-mounting`, `/fort-worth-tv-mounting`, `/dallas-tv-mounting`, `/houston-tv-mounting` | `pages/cities/CityPage.tsx` | SEO city landing (fixed slugs) |
| `*` | `pages/NotFound.tsx` | 404 |

Providers wrapping all routes: `QueryClientProvider` (TanStack Query, staleTime 5min), `AuthProvider`, `HelmetProvider`, `ServicesCacheProvider`, `TestingModeProvider`, `Toaster`. `useSecurityHeaders` enforces CSP/HSTS/etc client-side. `preloadZipIndex()` warms local ZIP cache on idle. Stale-chunk error handler reloads once when dynamic imports fail after a redeploy.

**Component ownership by domain:**
- Customer booking: `src/components/booking/*` (~20 step components), `EnhancedInlineBookingFlow`, `TvMountingModal`, `CheckoutModal`, `EmbeddedCheckout`.
- Worker dashboard: `src/components/worker/*` (30+ components): `WorkerJobsTab`, `WorkerJobCard`, `AddServicesModal`, `RemoveServicesModal`, `OnSiteChargeModal`, `RescheduleJobModal`, `ReassignJobModal`, `WorkerCalendar`, `WorkerScheduleManager`, `WorkerTipsHistory`, `WorkerEarnings`, `WorkerWeeklyEarnings`, service-area sub-tree.
- Admin panel: `src/components/admin/*` (120+ files) — services manager, bookings, workers, invoices, coupons, email/SMS logs, pricing integrity monitor, service operations monitor, testing mode toggle, Stripe mode toggle, worker approvals, admin impersonation.
- shadcn UI primitives: `src/components/ui/*`.

## 5. Business logic modules — centralization vs fragility

### Pricing
- **Central:** `src/utils/pricingEngine.ts` (`getAddOnPrice`, `getTierPrice`, `calculateTvMountingTotal`, `validateAllPricing`), `src/utils/pricingDisplay.ts`, `src/lib/pricing/getEffectiveServicePrice.ts` (frontend tier helper), `supabase/functions/_shared/pricing.ts` (mirror for edge), DB trigger `validate_pricing_consistency`.
- **Fragility:** Historically **duplicated** across `TvMountingModal`, `AddServicesModal`, `useTvMountingModal`, edge functions, and `pricingEngine`. Recently unified for Mount TV tiered pricing on the worker path (`AddServicesModal` + `add-booking-services` now share the `_shared/pricing.ts` mirror). The `pricingEngine`/`_shared/pricing.ts` split still means **two copies of the tier math** must be kept in lockstep. `PRICING_ARCHITECTURE.md` documents this as an active risk.

### Booking / scheduling
- **Central:** DB RPCs `get_available_time_slots`, `zip_has_active_coverage`, `validate_booking_has_coverage` trigger, `set_worker_weekly_availability`, `get_worker_weekly_availability`. Hooks: `useBookingOperations`, `useBookingFlowState`, `useBookingFormState`, `useWorkerAvailability`, `useZctaWorkerAvailability`.
- **Fragility:** Two dashboard shells (`WorkerDashboard.tsx` + `WorkerDashboardWithSidebar.tsx`) — potential drift. Booking validation is duplicated at three layers (frontend form, `useBookingOperations`, DB trigger) — intentional but requires coordinated updates.

### Worker assignment / coverage
- **Central:** `assign-authorized-booking-worker` edge function (UPSERT pattern), `unified-spatial-operations`, `worker_service_zipcodes` normalized table populated from polygons or manual entry.
- **Fragility:** Coverage sourced from three places — `worker_service_areas.polygon_coordinates`, `worker_service_zipcodes.from_manual`, `worker_service_zipcodes.from_polygon`. `worker_coverage_overlays` caches derived geom; must be refreshed on polygon edits (`service-area-upsert`). Reassignment flow has a 7-day authorization check (Stripe hold expiry) that lives only in the reassign edge function — reflected in memory but not documented centrally.

### Payment capture / refund
- **Central:** `payment-engine` is the **only** file allowed to call Stripe PI mutation methods. All other functions are thin proxies. Optimistic concurrency via `bookings.payment_version`. Idempotency via `idempotency_records`. Successful captures always land as `payment_status='captured'`.
- **Fragility:** Multiple proxy functions still exist for legacy compatibility (`capture-payment-intent`, `charge-saved-payment-method`, `cancel-payment-intent`, `create-payment-intent`, `confirm-payment`, `sync-payment-after-modification`, `unified-payment-authorization`). They all defer to `payment-engine`, but the surface area for accidental bypass is large. Test/live mode toggle depends on both `STRIPE_MODE` (backend) and `VITE_STRIPE_MODE` (frontend) being in sync AND all dependent functions being manually redeployed after secret changes.

### Notification system
- **Central:** `unified-email-dispatcher` (Resend, template routing by `emailType`), `send-sms-notification` / `send-customer-sms-notification` (Twilio, MessagingServiceSid `MG39ef21acfa0ebcdc51`). `sms_logs` and `email_logs` audit tables. `booking-notification-watchdog` cron.
- **Fragility:** Duplicated per-flow email functions still exist alongside the unified dispatcher: `send-customer-booking-confirmation-email`, `send-worker-assignment-notification`, `send-increment-notification`, `send-invoice-email`. Recent unified-email-dispatcher logs show it being called with `undefined` payloads (`bookingId, recipientEmail, and emailType are required` errors) — active caller-side bug. SMS requires explicit `sms_consent=true` and E.164 formatting; formatting logic duplicated in three SMS functions.

### Zip / ZCTA coverage
- **Central:** `us_zip_codes` (centroids), `us_zcta_polygons` (PostGIS geom), `worker_service_zipcodes` (join table), `zip_coverage_summary` materialized view, `zip_has_active_coverage()` RPC, `unified-spatial-operations` edge function, local `src/utils/localZipIndex.ts` cache preloaded on idle.
- **Fragility:** Multiple ZCTA importers historically (`import-zcta-data` current; `comprehensive-zip-data-importer`, `enhanced-zipcode-data-loader`, `load-complete-zipcode-data` archived). Client-side validation hooks are duplicated: `useZipcodeValidation`, `useOptimizedZipcodeValidation`, `useZipcodeSearch`, `useZctaBookingIntegration`, `useZctaBookingValidation`, `useOptimizedZctaService`. Several ZCTA docs in the repo root (`ZCTA_*.md`) document past migrations — likely stale.

## 6. Third-party integrations

| Integration | Purpose | Secret(s) | Called from |
|---|---|---|---|
| **Stripe** (payments) | PaymentIntents (manual capture), SetupIntents, customers, refunds | `STRIPE_SECRET_KEY`, `STRIPE_SECRET_KEY_TEST`, `STRIPE_MODE`; frontend `VITE_STRIPE_MODE` + hardcoded publishable keys in `src/lib/stripe.ts` | Only `payment-engine` edge function (all other Stripe-touching functions are proxies). Frontend uses `@stripe/react-stripe-js` via `StripeCardElement`, `useStripePayment`. |
| **Twilio** (SMS) | Booking confirmations, worker assignment, reminders | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_MESSAGING_SERVICE_SID` | `send-sms-notification`, `send-customer-sms-notification`. Logs to `sms_logs`. |
| **Resend** (email) | Transactional email (confirmation, worker assignment, invoice, welcome, password reset) | `RESEND_API_KEY` | `unified-email-dispatcher`, `send-invoice-email`, `send-customer-booking-confirmation-email`, `send-worker-assignment-notification`, `send-increment-notification`. Logs to `email_logs`. |
| **Supabase** (BaaS) | Auth, Postgres/PostGIS, Storage (invoice PDFs), Edge Functions, Realtime | Auto-injected `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Everywhere. Frontend imports `@/integrations/supabase/client`. |
| **OpenDataDE** (public data) | US ZCTA polygon GeoJSON per state; ZIP centroid CSV | none (public) | `import-zcta-data`, `seed-us-zip-codes`. |
| **Google Analytics / gtag** | Success metric tracking | uses `window.gtag` at runtime | `usePublicServicesData` and other hooks emit custom events. |
| **Lovable MCP** | Agent tool surface (`list_services`, `check_service_area`) | none | `supabase/functions/mcp/index.ts` (auto-generated from `src/lib/mcp/*`). |

**Not integrated:** No maps provider (Mapbox/Google Maps) is imported anywhere — coverage maps are rendered from PostGIS geom + Leaflet/local drawing (see `ServiceCoverageMap*.tsx`). No SendGrid, no direct SMTP, no shipping/inventory providers.

## 7. Known bugs & limitations

Extracted from `docs/KNOWN_LIMITATIONS.md` and cross-referenced with runtime logs and recent memory entries.

**Performance:**
- Payment authorization 2-5s round-trip (Stripe latency) — planned async processing Q2 2025.
- Service catalog with 50+ items renders slowly — virtual scroll planned Q3 2025.
- Realtime updates debounced 300ms.

**UX:**
- No bulk-add of services.
- Limited error-recovery UI when operations fail mid-flow.
- No undo functionality on service add/remove.
- Mobile experience explicitly documented as **not** fully optimized.

**Data/validation:**
- `booking_services.configuration` jsonb has no enforced schema.
- No versioning on service `pricing_config` — historical bookings can be reinterpreted if config changes.
- Validation error messages generic on some paths.
- Quantity capped at 100 per line.

**Integrations:**
- Payments Stripe-only (no PayPal/Paddle).
- Invoice auto-generation exists but no auto-send in some flows.
- No external system sync (QuickBooks, CRM, etc.).

**Monitoring/analytics:**
- 7-day log retention on `service_operation_logs`.
- No real-time alerting (only daily `detect-uncaptured-payments` cron).
- Analytics granularity limited to time buckets in `v_service_operation_analytics`.
- No client-side performance tracking beyond `usePerformanceMonitoring`.

**Scalability:**
- Operation queue is single-threaded per client.
- Supabase Realtime scaling not stress-tested.
- No CDN caching strategy for service list.

**Security:**
- All services visible to workers (no per-worker service allowlist).
- No audit trail on `services.pricing_config` changes.
- **Roles stored in `users.role` column, not a separate `user_roles` table** — flagged in Lovable memory as a privilege-escalation risk pattern to migrate.

**Active bugs observed this session (not in docs):**
- `unified-email-dispatcher` recently invoked with `bookingId=undefined, emailType=undefined` (see edge logs 2026-07-07). Caller passes stale/empty payload. Not root-caused.
- Two worker dashboard shells (`WorkerDashboard.tsx`, `WorkerDashboardWithSidebar.tsx`) coexist — drift risk.
- Multiple ZCTA import strategies coexist (`import-zcta-data` active; three archived importers still in repo).
- Node zlib / utf-8-validate / bufferutil "module not found" warnings on every edge function boot — cosmetic (Deno vs Node deps) but noisy.

**Rebuild-planning notes**
- Enforce the `user_roles` separate-table pattern (project memory Core rule) — current single-column `users.role` is a known privilege-escalation risk.
- Consolidate all pricing math into a **single** shared module used by both frontend and edge; the current DB↔frontend↔edge triple must stay in lockstep manually.
- Reduce the proxy-function sprawl around `payment-engine` (10+ functions that just forward).
- Deduplicate email dispatch (unified dispatcher + 4 per-flow senders).
- Consolidate worker dashboards.
