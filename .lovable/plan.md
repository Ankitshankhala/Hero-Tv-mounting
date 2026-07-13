# Code Review — Hero TV Mounting

Scope: full repo scan (src/, supabase/functions/, config). ~91.6k LOC frontend, 49 edge functions (~10.4k LOC). Findings are ranked by risk × effort. Nothing below has been changed — this is a review.

## 1. Security

### 1.1 `process.env.SUPABASE_SERVICE_ROLE_KEY` reachable from frontend bundle — HIGH
`src/utils/transactionManager.ts` reads `process.env.SUPABASE_URL` and `process.env.SUPABASE_SERVICE_ROLE_KEY` and constructs a service-role Supabase client. Even though `useServiceRole` defaults to `false`, the code path exists in a file imported from the browser bundle. Vite will inline any matching env at build time and, more importantly, the pattern invites future callers to pass `true` from frontend code. Service-role keys must never appear in a client-shipped module.
- Fix: split into two files — `transactionManager.client.ts` (anon only) and `transactionManager.server.ts` (edge-function only, using `Deno.env.get`). Delete the `useServiceRole` branch from anything under `src/`.

### 1.2 Duplicated inline CORS + wildcard `Access-Control-Allow-Origin: *` across 36 edge functions — MEDIUM
Every function redeclares `const corsHeaders = { 'Access-Control-Allow-Origin': '*', ... }`. This drifts, and `*` is fine for pure public endpoints but wrong for anything that reads cookies or accepts credentials. Payment and admin-only functions should restrict to the app origin(s).
- Fix: centralize in `supabase/functions/_shared/cors.ts` and read allowed origins from an env var. Reflect the request `Origin` only if it matches an allowlist for privileged functions.

### 1.3 `verify_jwt = false` is the default for most edge functions — MEDIUM
34 of ~49 functions run with `verify_jwt = false`. That's acceptable under the signing-keys model **only if** the function validates the JWT in code. Spot check needed for: `add-booking-services`, `worker-cancel-booking`, `worker-complete-and-capture`, `worker-remove-services`, `worker-reassign-booking`, `admin-process-refund`, `sync-payment-after-modification`, `assign-authorized-booking-worker`. Any that skip `getUser(token)` + role check are effectively unauthenticated.
- Fix: audit each and standardize on a `_shared/auth.ts` `requireRole(req, ['admin'|'worker'|...])` helper. Fail closed.

### 1.4 480 `any` / `as any` casts in `src/` — MEDIUM
Ambient `any` is the largest single source of runtime surprises in this codebase (payment amounts, IDs, service configs frequently pass through `any`). Combined with money math, this is a real correctness risk.
- Fix: enable `noImplicitAny` + `strictNullChecks` on the shared code that touches pricing, bookings, transactions. Introduce zod schemas at every edge-function boundary (currently missing on most).

### 1.5 226 files still contain `console.log` / `console.error` — LOW/MED
A `scripts/replace-console-logs.js` exists but hasn't been run/finished. Beyond noise, some logs likely include PII (emails, addresses, PaymentIntent IDs — already visible in `BookingFlow.tsx`). Ship `logger.ts` + lint rule `no-console` with tiered levels.

### 1.6 Missing server-side input validation on edge functions — MEDIUM
Spot-checking `create-guest-booking`, `payment-engine`, `add-booking-services`: request bodies are destructured directly. Guidance in `.lovable` explicitly requires zod validation with 400 on failure. Only a handful of functions do this.

### 1.7 Security memory not yet consulted for this repo — INFO
Recommend running `security--run_security_scan` and reviewing RLS on the 40+ tables. Notable: `bookings` has 9 policies, `users` has 9 policies — worth confirming no policy uses `auth.users` metadata for role checks (must be `user_roles` + `has_role` per Lovable rules).

## 2. Architecture & Quality

### 2.1 Payment-engine monolith (1,467 LOC in one file) — HIGH
`supabase/functions/payment-engine/index.ts` handles authorize, capture, complete-and-capture, refunds, coupon usage, tip sync — the recent Phase 1/2/3 pricing refactor left it as the sole hot path, but the file is now hard to review and easy to regress. It also duplicates concerns with `sync-payment-after-modification`, `capture-payment-intent`, `charge-saved-payment-method`, `confirm-payment`, `create-payment-intent`, `unified-payment-authorization`, `unified-payment-verification`, `worker-complete-and-capture`.
- Fix: split by action into `payment-engine/actions/*.ts`, share a `_shared/payments.ts`. Deprecate the parallel functions once the engine covers them — the old ones are footguns.

### 2.2 Duplicated components — MEDIUM
Multiple side-by-side implementations still present:
- `InlineBookingFlow.tsx` + `EnhancedInlineBookingFlow.tsx`
- `ServiceCoverageMap.tsx` + `ServiceCoverageMapEnhanced.tsx` + `ServiceCoverageMapWithBoundaries.tsx`
- `pages/WorkerDashboard.tsx` + `WorkerDashboardWithSidebar.tsx`
- `pages/Admin.tsx` + `AdminDashboard.tsx`
`.jscpd.json` exists but no CI gate is wired. Pick one canonical version per pair and delete the others (behind a scoped, additive PR similar to the pricing phases).

### 2.3 Repo hygiene — LOW
18 top-level markdown files (multiple ZCTA/phase summaries), stray files `tash`, `temp_add_zipcode.js`, `temp_function.txt`, `test-worker-email.sql`, `trigger-assignment.js`, `test-zipcode-implementation.js`. Move docs under `docs/` and delete temp scripts.

### 2.4 Hooks folder is 72 files — LOW
Several near-duplicates: `useZipBoundaries` vs `useZctaBoundaries`, `useSynchronizedServiceAreas` (now just a re-export shim) vs `useSimplifiedServiceAreas`, `useRealtimeInvoices` vs `useRealTimeInvoiceOperations`. Consolidate.

### 2.5 `App.tsx` route duplication — LOW
Five hard-coded city routes plus the `/locations/:slug` catch-all — the specific paths render the same `CityPage`. Either redirect the legacy paths or drive both from a single map.

## 3. Performance

### 3.1 Realtime and query patterns — MEDIUM
Several `useRealtime*` hooks likely subscribe without proper cleanup or scope filters (project guideline explicitly warns about this = Realtime billing). Audit each channel for `useEffect` + `removeChannel` and a `filter:` on the subscription.

### 3.2 `staleTime: 5min`, `gcTime: 30min` globally — LOW
Reasonable defaults, but pricing/service data currently refetches on every mount in some hooks (`useServicesData`, `usePublicServicesData`) — pick one canonical services hook and share the query key.

### 3.3 Bundle — LOW
Landing page eagerly imports `Index`, which itself pulls in heavy sections (map, reviews, blog). Consider lazy-loading below-the-fold sections; also verify `leaflet` + `react-big-calendar` + `recharts` aren't in the initial chunk.

### 3.4 Supabase 1000-row default limit — MED
Confirm admin dashboards (bookings/invoices/transactions) paginate — the memory index already flags this as a known constraint.

## 4. Testing & CI

### 4.1 Test coverage — MEDIUM
Only files present: `src/__tests__/pricing.contract.test.ts`, `src/utils/__tests__/clone-prevention.test.ts`, `tests/unit/serviceValidation.test.ts`, `tests/integration/addServices.test.ts`, a handful of Playwright specs. No tests for payment-engine actions, coupon logic, refund path, or capture-before-complete trigger. High-value additions:
- Deno tests for each `payment-engine` action (mock Stripe).
- Trigger test for `enforce_capture_before_complete` (SQL in a migration test).
- Playwright: full booking → authorize → complete-and-capture → refund happy path.

### 4.2 CI runs Playwright without a seeded DB — MEDIUM
`.github/workflows/ci.yml` runs `npx playwright test` after `npm run build` but no Supabase local instance is started. Either mark the e2e job as smoke-only or spin up `supabase start` in CI.

### 4.3 No lint-on-CI — LOW
`npm run lint` exists but isn't in the workflow. Also add `tsgo` typecheck and a `no-console` rule.

## 5. Database / Migrations

### 5.1 Trigger + grants audit — MEDIUM
Recent capture-before-complete trigger is good. Recommend also:
- Trigger to disallow `status='completed'` without `captured_at` timestamp (already covered indirectly).
- Confirm every `public` table has an explicit GRANT block (recent guideline). Older tables may be relying on legacy default privileges.

### 5.2 Coupon usage is now written at authorization, not booking creation — INFO
Ensure a partial index on `coupon_usage(booking_id)` exists (used for the idempotency pre-check added in the last phase). Without it, that pre-check does a seq scan at scale.

## 6. Recommended sequence

Suggested phased PRs — each additive and scoped like the recent pricing series:

1. **Security hardening (Phase A)** — split `transactionManager` (1.1), centralize CORS + origin allowlist (1.2), zod-validate every mutating edge function (1.6), enable `no-console` + finish logger migration (1.5).
2. **Auth audit (Phase B)** — `_shared/auth.ts` + apply to every `verify_jwt=false` function (1.3). Run + review `security--run_security_scan`.
3. **Payment-engine split (Phase C)** — decompose `payment-engine/index.ts` (2.1), retire parallel payment functions.
4. **Dedup + cleanup (Phase D)** — remove duplicate components/hooks (2.2, 2.4), tidy repo root (2.3).
5. **Tests + CI (Phase E)** — payment-engine Deno tests, Playwright happy path, lint + typecheck in CI (4.x).
6. **Perf pass (Phase F)** — realtime cleanup audit (3.1), consolidate services hooks (3.2), bundle audit (3.3), admin pagination (3.4).

## 7. What NOT to change

- Pricing modules (`@shared/pricing`, `pricingEngine`, `pricingDisplay`, `pricing.ts`, `getEffectiveServicePrice.ts`) — Phase 1/2/3 landed cleanly. Contract tests are green; keep them as the guard.
- Capture-before-complete trigger and `payment-engine` `complete-and-capture` branches — recently hardened.
- Coupon usage recording location (moved to `authorize`) — correct per business rule.

---

If you want, I can turn any single phase above into a scoped, additive implementation plan (same shape as the recent pricing phases) as the next step. Which phase should I start with?
