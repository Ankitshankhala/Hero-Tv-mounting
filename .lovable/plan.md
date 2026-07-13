# Legitimate anon/public read access — inventory before tightening RLS

Read-only findings. This maps what the app **actually depends on** today so the RLS fix can preserve exactly this surface and nothing more.

---

## 1. Guest booking confirmation — no direct anon read

`src/pages/BookingSuccess.tsx` does **not** query `bookings` from the client. It reads `?session_id=…` from the URL and calls the `verify-payment` edge function, which returns the booking object in its response body (edge function runs with service-role, RLS bypassed):

```ts
const sessionId = searchParams.get('session_id');
const { data } = await supabase.functions.invoke('verify-payment', { body: { session_id: sessionId } });
setBooking(data.booking);
```

**Implication for RLS:** guest booking confirmation does **not** require anon SELECT on `bookings`. The existing anon-can-read-any-guest-booking policy (C1 in the earlier audit) can be dropped without breaking this page.

## 2. Frontend booking reads without login

Only one anon-adjacent read exists: `src/components/EnhancedInlineBookingFlow.tsx:129` re-fetches the booking the current tab just created, using an id it holds in `sessionStorage` during the checkout wizard:

```ts
supabase.from('bookings').select('id, payment_status, status').eq('id', pendingBookingId).single()
```

This runs mid-flow (before payment capture) to detect a stale/completed pending booking on page reload. The user may not be authenticated yet (guest checkout). It only needs 3 non-PII columns for a booking id **the client just created in the same session**.

Everything else that reads `bookings` requires auth:
- `CustomerDashboard.tsx:61` — logged-in customer, scoped to `customer_id = auth.uid()`.
- `WorkerDashboard*.tsx`, `useBookingManager.tsx`, all `admin/*` components — worker/admin auth.
- Edge functions (`verify-payment`, `payment-engine`, `generate-invoice`, notification dispatchers, etc.) — service-role, RLS bypassed.

No tracking page, no invoice-view-by-token, no review-request landing page currently reads bookings anonymously. Invoice reads (`useInvoiceOperations`, `InvoicesManager`) are all admin-context.

**Implication for RLS:** the only anon read to preserve on `bookings` is a narrow one — the "same-tab pending booking probe" — and it can be satisfied by (a) requiring a matching `reservation_token` / short-lived nonce column instead of raw id, or (b) moving the probe to an edge function. Simplest preservation path if you don't want to refactor client code: allow anon SELECT of `id, payment_status, status` **only** while `reservation_expires_at > now()` and `payment_status != 'captured'`. No other anon SELECT paths on `bookings` need to survive.

## 3. Worker PII on public/customer surfaces

One place displays worker identity to a non-admin: `src/pages/CustomerDashboard.tsx:61` joins:

```ts
worker:users!worker_id(name, phone)
```

and renders `booking.worker?.name` (line 83). This is **authenticated** (customer viewing their own booking) — not anon. Only two columns needed: `name` and `phone`. No photo, no email, no coordinates, no address are displayed anywhere customer-facing.

`src/components/InlineBookingFlow.tsx:100` reads `users` anon-ishly during zip lookup:

```ts
.from('users').select('id, zip_code').eq('role', 'worker').eq('is_active', true)
```

Only to count available workers in a ZIP prefix for the "N technicians available" UI. Needs `id, zip_code, role, is_active` — no PII.

**Implication for RLS:** the current anon-read of full `users` rows for active workers (audit item C3) is far broader than needed. Legitimate surface is:
- Anon / any-role: `id, zip_code` filtered to `role='worker' AND is_active=true` (worker count UI). Consider replacing with a `worker_coverage_public` view or `count_workers_by_zip` RPC and dropping anon read entirely.
- Authenticated customer: `name, phone` for `worker_id` that appears on one of their own bookings — best served by a security-definer RPC (`get_my_booking_worker(booking_id)`) or a view joined via RLS predicate.

Nothing public displays worker photos, emails, home addresses, or lat/lng — those columns have no legitimate anon/customer read.

## 4. Coupons — direct client reads exist by design

`src/hooks/usePublicCoupons.ts` reads `coupons` directly from the client (no edge function):

```ts
supabase.from('coupons')
  .select('id, code, discount_type, discount_value, max_discount_amount, min_order_amount, valid_until, usage_limit_total, usage_count')
  .eq('is_active', true)
  .lte('valid_from', nowIso)
  .gte('valid_until', nowIso);
```

Consumed by 4 marketing surfaces: `PromoBanner`, `MobilePromoBar`, `HeroPromoStrip`, `CheckoutPromoReminder`. These are the "10% OFF — code SAVE10" strips on the homepage/checkout — coupon codes are intentionally advertised to anon visitors.

Coupon **application** goes through the `validate-coupon` edge function (see `CouponSection.tsx`). Admin CRUD goes through `useCoupons.ts` under admin auth.

**Implication for RLS:** anon SELECT on `coupons` must stay, but only for the 9 columns above and only for active+in-window rows. The current policy that leaks *all* active coupons regardless of window (audit H2) can be narrowed to the same predicate this hook already applies. Non-advertised columns (`created_by`, targeting rules, per-user caps, internal notes) should be excluded — ideally via a `coupons_public` view.

## 5. app_settings — a single key is in use

`SELECT key FROM public.app_settings` returns exactly one row: **`stripe_mode`**.

- **Anon read required:** `stripe_mode` — hydrated on app boot by `src/lib/stripe.ts:hydrateStripeMode` and subscribed via realtime (`app_settings:stripe_mode` channel) to switch the frontend between test/live Stripe keys. This runs before login on every page, so it must be anon-readable.
- **Admin-only writes:** `useStripeMode.setMode` and `StripeModeToggle` — already gated by admin UI, needs RLS to enforce write restriction.
- **Everything else:** no other keys exist today, so no other reads to preserve.

**Implication for RLS:** rather than "anon can read all app_settings", scope anon SELECT to `key = 'stripe_mode'` (or a small allow-list). Add a permissive realtime-compatible policy for that specific key. All writes → admin only via `has_role(auth.uid(), 'admin')`.

---

## Summary table — surface to preserve

| Table | Anon needs | Authenticated (customer) needs | Notes |
|---|---|---|---|
| `bookings` | Same-tab pending probe: `id, payment_status, status` while unexpired | Own bookings via `customer_id = auth.uid()` | Guest confirmation goes through `verify-payment` edge function — no direct anon read |
| `booking_services` | None | Join through own bookings | Current anon read (C2) is unused by the app |
| `users` (worker rows) | Worker count for ZIP UI: `id, zip_code` only, filtered `role='worker' AND is_active=true` | `name, phone` for their assigned worker only | Prefer RPC/view. Never expose email/lat/lng/address publicly |
| `coupons` | Active+in-window rows, 9 marketing columns | Same | Prefer a `coupons_public` view |
| `app_settings` | `key = 'stripe_mode'` only | Same | Writes: admin only |
| `worker_service_zipcodes` | Zip coverage lookup (already used by anon booking flow) | Same | Legitimate — powers "we service your area" |
| `coupon_usage`, `coupon_audit_log`, `booking_audit_log`, `stripe_customers`, `transactions`, `invoices`, `invoice_items`, `email_logs`, `sms_logs`, `worker_availability`, `worker_schedule`, `worker_applications`, `worker_notifications`, `worker_bookings`, `admin_*`, `rls_debug_logs`, etc. | **None** | Auth-only surfaces | No frontend anon paths found |

---

## Recommended shape of the Phase-2 RLS fix (for approval; no changes yet)

1. **`bookings`** — drop anon SELECT. Replace with a narrow policy: `anon` may SELECT `id, payment_status, status` where `reservation_expires_at > now() AND payment_status <> 'captured'`. Better long-term: move the `EnhancedInlineBookingFlow` probe behind an edge function and disallow anon SELECT entirely.
2. **`booking_services`** — drop anon SELECT (no consumer).
3. **`users`** — replace the "active workers world-readable" policy with (a) an RPC `public.count_active_workers_by_zip(prefix)` for the anon worker-count UI, and (b) an RPC `public.get_booking_worker_contact(booking_id)` for the customer dashboard join. Then customer/anon SELECT on `users` can be denied outright; only self-read + admin remain.
4. **`coupons`** — replace anon SELECT with a policy scoped to `is_active AND now() BETWEEN valid_from AND valid_until`, and expose only the 9 marketing columns via a `coupons_public` view (`security_invoker=on`). Point `usePublicCoupons` at the view.
5. **`app_settings`** — anon SELECT restricted to `key = 'stripe_mode'`; INSERT/UPDATE restricted to `has_role(auth.uid(),'admin')`; keep realtime publication (still works with row-level policy).
6. **`bookings` writes** — remove customer UPDATE rights to `payment_status`, `authorized_amount`, `worker_id`, `stripe_payment_intent_id` (audit H1). Use column-level policy or a trigger that rejects updates to those columns from the `authenticated` role, allowing only `customer_notes`/`special_instructions`-style fields.

Awaiting your approval on the shape before I draft migrations.
