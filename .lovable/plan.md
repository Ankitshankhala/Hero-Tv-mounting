
# Phase 1 — Schema + RLS Audit (read-only)

Scope: `public` schema. 42 tables. All findings below are observations from `pg_policies`, `pg_constraint`, and `information_schema` — no edits performed.

---

## 1. RLS enablement

RLS is ON for every user-data table. Two exceptions:

| Table | RLS | Notes |
|---|---|---|
| `spatial_ref_sys` | OFF | PostGIS system table — expected, ignore |
| `invoice_sequences` | **OFF** | 2 rows, holds invoice-number counters. Not PII, but Data API can read/increment. **Medium** |

---

## 2. Table inventory (approx row counts + purpose)

| Table | Rows | Purpose |
|---|---|---|
| bookings | 616 | Core booking records (guest + customer) |
| booking_services | 1144 | Line items per booking |
| booking_audit_log | 2364 | Booking change history |
| transactions | 515 | Stripe charges/authorizations |
| invoices / invoice_items / invoice_audit_log / invoice_service_modifications | 320/762/649/48 | Billing |
| invoice_sequences | 2 | Invoice numbering (RLS OFF) |
| users | 11 | Customers, workers, admins |
| stripe_customers | 96 | Stripe customer + default PM tokens |
| coupons / coupon_services / coupon_usage / coupon_audit_log | — | Discount system |
| services | 45 | Service catalog |
| worker_applications | 6 | Job applicants |
| worker_availability / worker_schedule | 56/18 | Worker calendar |
| worker_bookings | 462 | Worker↔booking assignment |
| worker_service_areas / worker_service_zipcodes | 7/2204 | Worker coverage geo |
| worker_coverage_overlays / worker_coverage_notifications / worker_notifications | — | Coverage & notif workflow |
| service_area_audit_logs | 1533 | Coverage change history |
| service_operation_logs | — | Service ops trace |
| sms_logs | 132833 | Twilio message log |
| email_logs | 1372 | Outbound email log |
| admin_alerts / admin_impersonation_sessions | — | Admin tooling |
| app_settings / app_settings_audit | — | Runtime config (incl. `stripe_mode`) |
| notification_settings | — | Admin config |
| idempotency_records | 4 | Dedupe |
| rls_debug_logs | — | Debug |
| tip_sync_log | — | Tip reconciliation |
| state_tax_rates | 51 | Tax config |
| us_zcta_polygons / us_zip_codes | 33k/5 | Public geo |
| zcta_import_state | — | Import bookkeeping |

---

## 3. Findings by severity

### CRITICAL — data-leak / security hole

**C1. Anon can read every guest booking (`bookings`)**
Policy `"Enable guest booking viewing during checkout"` (role `public`) has qual:
```
(customer_id IS NULL AND status='payment_pending')
 OR (customer_id IS NULL AND payment_intent_id IS NOT NULL)
```
No session/token/email match. Once `payment_intent_id` is set (which happens on essentially every guest checkout), the row is world-readable **forever** — including `guest_customer_info` (name, email, phone, address), `tip_amount`, `authorized_amount`, `captured_amount`, `payment_intent_id`, `stripe_customer_id`, `stripe_payment_method_id`, `coupon_code`, `scheduled_date`. Guest orders are a majority of your data. **This is a full customer-PII + payment-metadata leak to anon.**

**C2. Anon can read every guest booking's line items (`booking_services`)**
Policy `"Enable guest booking services viewing"` mirrors C1 — anon reads every service/price row for any guest booking with a payment_intent_id.

**C3. Anon can read all worker PII (`users`)**
Policy `"Public can view active worker info"` (role `public`, `role='worker' AND is_active=true`) grants SELECT on the whole row. `users` includes `email`, `phone`, `city`, `zipcode`, `latitude`, `longitude`. Any unauthenticated visitor can enumerate every active worker with contact info + home coords via the Data API.

---

### HIGH — meaningful privilege / integrity gap

**H1. Customers can UPDATE payment fields on their own bookings**
Policy `"Customers can update own bookings"`: `USING (customer_id=auth.uid())` and `WITH CHECK (customer_id=auth.uid())` — no column list. A signed-in customer can PATCH `payment_status`, `authorized_amount`, `captured_amount`, `tip_amount`, `worker_id`, `coupon_discount`, `payment_intent_id`, etc. directly via PostgREST. Any financial invariant enforced only in edge functions is bypassable.

**H2. All active coupon codes are anon-readable (`coupons`)**
`"Public can view active valid coupons"` returns every row where `is_active AND now() BETWEEN valid_from AND valid_until`. Codes intended as targeted/private (staff, retention, VIP) are enumerable. Combined with `coupon_services` also being public-readable, the entire promo matrix is exposed.

**H3. `app_settings` is world-readable**
`"Anyone can read app settings"` qual `true`, role `public`. Whatever is stored here (Stripe mode toggle at minimum; check for any secrets or feature flags that shouldn't be exposed) leaks to anon. Not a leak if contents are truly non-sensitive, but the blanket-true policy means every future key added is public by default — **latent risk**.

---

### MEDIUM — best-practice / hardening

**M1. `invoice_sequences` has RLS disabled** — 2-row counter table; Data API can read and (with grants) mutate it. Even if grants are limited, RLS should be ON with a service-role-only policy.

**M2. Worker geo mapping is anon-readable**
`worker_service_zipcodes` `"System can view zip codes for assignment"` = `true`, `worker_service_areas` `"System can view service areas for assignment"` = `is_active=true`. Combined with C3, an attacker can build a full map of which worker covers which ZIPs. Likely intentional for the coverage map — confirm whether `worker_id` needs to be exposed or if it should be aggregated.

**M3. `stripe_customers` email fallback**
`"Users can view their own stripe customer record"` qual `(user_id=auth.uid() OR email=auth.email())`. Safe as long as `email` is NOT NULL and `auth.email()` returns null for anon. Worth pinning down (add `email IS NOT NULL AND auth.email() IS NOT NULL`).

**M4. Missing FKs / ON DELETE gaps**

| Column | Current | Risk |
|---|---|---|
| `email_logs.booking_id` | **no FK** | orphans on booking delete |
| `booking_audit_log.booking_id` | **no FK** | orphans (may be intentional for audit persistence) |
| `idempotency_records.user_id` | **no FK** | orphans |
| `worker_service_areas.worker_id` | **no FK** | orphans / integrity |
| `worker_coverage_overlays.worker_id` | **no FK** | orphans |
| `service_area_audit_logs.worker_id` | **no FK** | orphans |
| `sms_logs.booking_id` | FK, **no ON DELETE** | blocks booking delete |
| `tip_sync_log.booking_id`, `transaction_id` | FK, **no ON DELETE** | blocks delete |
| `worker_coverage_notifications.booking_id`, `worker_id` | FK, **no ON DELETE** | blocks delete |
| `transactions.cancelled_by`, `captured_by` | FK, **no ON DELETE** | blocks user delete |

`booking_services.booking_id` **is** properly `FK … ON DELETE CASCADE` — confirmed, no orphan risk there.

**M5. Duplicate / redundant policies** — `users` has 3 near-identical SELECT-own policies and 2 UPDATE-own policies; `worker_availability`, `worker_bookings`, `worker_schedule` each have overlapping admin/worker ALL policies. Not a leak, but any future tightening has multiple stacked permissive rules to prune.

**M6. Hardcoded email admin escape hatch on `users`**
`"Direct admin access"` policy: `(auth.jwt() ->> 'email') = 'captain@herotvmounting.com'`. Works, but couples auth to a mutable identity claim; use role-based `has_role()` instead.

**M7. `worker_applications` INSERT is `WITH CHECK true` for anon** — expected (public form), but no rate limiting → spam risk. Non-security, operational.

---

### PCI / payment-data storage — clean ✅

Scanned columns matching `card`, `cvv`, `pan`, `secret`, `api_key`, `password`, `ssn`. Only match: `users.has_saved_card` (boolean flag). Payment persistence uses Stripe tokens only (`stripe_customer_id`, `stripe_payment_method_id`, `payment_intent_id`) — no raw card data, no Stripe secret keys in DB. Nothing to remediate here.

---

## 4. Cross-role escalation summary

| Attempt | Result |
|---|---|
| Anon → read another customer's booking | **YES if guest booking (C1)**; blocked for authed customer bookings |
| Anon → read another guest's line items | **YES (C2)** |
| Anon → read worker PII | **YES (C3)** |
| Anon → read active coupon codes | **YES (H2)** |
| Customer → read another customer's data | Blocked (auth.uid scoping OK) |
| Customer → modify own booking payment fields | **YES (H1)** |
| Customer → read admin tables (admin_alerts, sms_logs, email_logs, invoice_audit_log, transactions insert) | Blocked ✅ |
| Worker → read/modify another worker's bookings/availability/service areas | Blocked (worker_id=auth.uid scoping) ✅ |
| Worker → read another worker's coverage or notifications | Blocked ✅ |
| Worker → read admin tables | Blocked ✅ |

---

## Recommended Phase 2 scope (for your approval before any edits)

Ranked by blast radius:

1. **Fix C1 + C2** — replace the "any guest booking with a payment_intent_id" rule with a token-scoped model (e.g. require the client to pass a signed booking-lookup token, or move guest reads behind an edge function that validates email + last-4-digits or a session-bound token).
2. **Fix C3** — replace the full-row worker SELECT policy with a view/policy exposing only public columns (name, city, profile photo) — never email/phone/lat/lng to anon.
3. **Fix H1** — restrict `bookings` UPDATE for customers to a whitelist of columns (via revoking column privileges or moving all payment-affecting updates to edge functions with `service_role`).
4. **Fix H2** — remove public SELECT on `coupons`; validate codes via edge function.
5. **Fix H3 + M1** — either add an `is_public` gate on `app_settings` or list only whitelisted keys; enable RLS on `invoice_sequences`.
6. **M2 / M4 / M5 / M6** — cleanup pass: tighten anon-readable worker mapping, add missing FKs / ON DELETE clauses, dedupe redundant policies, replace hardcoded-email admin policy.

I'll wait for your go-ahead (and any scope changes) before drafting Phase 2 migrations.
