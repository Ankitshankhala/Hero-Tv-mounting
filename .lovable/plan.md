# Full-Stack Payment Flow Audit

## 1. Executive Summary

The architecture is now solid:
- Single source of truth for Stripe is `payment-engine` (1168 lines, all six actions implemented).
- Worker UI has exactly one finalization button (`Complete Job & Accept Payment`) → `worker-complete-and-capture` → `payment-engine.complete-and-capture` (atomic capture + complete + archive).
- `add-booking-services` and `worker-remove-services` no longer call Stripe directly; they delegate to `payment-engine`.
- Lower-amount capture after service removal is correctly handled as a no-op authorization update.
- DB guard `trg_enforce_completed_requires_capture` now prevents `status='completed'` without `payment_status IN ('captured','completed')`.
- Reauthorization 3DS handoff is wired end-to-end: engine returns `requires_customer_action` + `client_secret` + `new_payment_intent_id`; `add-booking-services` forwards them; `AddServicesModal` opens `ReauthorizePaymentDialog`; dialog calls `finalize-reauthorization` with Bearer token.

However there are still 3 must-fix bugs, plus several high-priority risks. **Not production-ready as-is**, but close.

---

## 2. Critical Issues — MUST fix before production

### C1. `worker-complete-and-capture` is called WITHOUT an Authorization header
File: `src/components/worker/JobActions.tsx` line 74-77.

```ts
supabase.functions.invoke('worker-complete-and-capture', {
  body: { booking_id: job.id }
});  // ❌ no headers
```

`worker-complete-and-capture` forwards `req.headers.get('Authorization')` to `payment-engine`, and the engine's `complete-and-capture` action calls `validateAuth(req.headers.get('Authorization'))` which throws `Authorization required` if the Bearer token is missing.

`supabase.functions.invoke` does pass the user's anon-key Authorization automatically only when JWT verification is enabled at the function. The project sets `verify_jwt = false` for almost every function (config.toml shows ~19 `false`, 1 `true`), so the SDK does NOT auto-attach the user JWT consistently — it sends the anon apikey. The engine's `validateAuth` calls `auth.getUser(token)` with that token; with the anon key it returns no user → throws.

**Fix (frontend):**
```ts
const { data: { session } } = await supabase.auth.getSession();
await supabase.functions.invoke('worker-complete-and-capture', {
  body: { booking_id: job.id },
  headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
});
```

Same issue in any other place that calls a payment-engine action — audit all `supabase.functions.invoke('worker-complete-and-capture' | 'capture-payment-intent' | 'payment-engine' | 'worker-remove-services' | 'add-booking-services')` call sites and add the Bearer header.

### C2. `worker-remove-services` uses `supabaseService.functions.invoke(...)` to call `payment-engine`, which forwards a service-role Authorization header
File: `supabase/functions/worker-remove-services/index.ts` line 232-239 and 254-266.

```ts
await supabaseService.functions.invoke('payment-engine', {
  ...,
  headers: { Authorization: authHeader },  // OK — uses caller's Bearer
});
```
This particular call passes the caller's `authHeader`, which is correct. BUT the client used is `supabaseService` (service-role client). `supabase.functions.invoke` from a service-role client appends the service role key as `apikey`; the explicit `Authorization` header you pass is what `validateAuth` reads, so this works. Verify with a real run — easy to break later by removing the explicit header.

Recommendation: use `supabaseClient` (anon client built with the user token) for invocations that the engine must authorize, and add a comment documenting why.

### C3. Mismatch on `requires_manual_payment` flag and the new completion guard
- `payment-engine.recalculate` sets `requires_manual_payment = true` whenever off-session re-auth fails *and* customer-action recovery also fails (line 403-413). It also sets it when the booking has no saved payment method (line 330-339).
- `worker-remove-services` (zero-total branch) sets `requires_manual_payment = true` and `payment_status = 'cancelled'` (line 189-193).
- `complete-and-capture` rejects `requires_manual_payment` (line 726-728).

Result: a booking can land in a state where the worker can never complete it via the unified button. There is no UI affordance to clear `requires_manual_payment` after the customer pays through some other channel. The "Collect Payment" button in `JobActions.tsx` only shows when `payment_status === 'failed' || 'cancelled'`, not when `requires_manual_payment === true` with `payment_status === 'authorized'`.

**Fix:** show the recovery / collect-payment UI whenever `requires_manual_payment === true`, OR have `worker-complete-and-capture` succeed when payment is already captured/cash and just clear the flag. Decide one path.

---

## 3. High-priority issues

### H1. `payment-engine.complete-and-capture` re-reads the DB without a row lock
Lines 688-693 SELECT booking with no `lock_booking_for_payment` call. Two near-simultaneous clicks of `Complete Job & Accept Payment` can both pass the `payment_status === 'authorized'` guard. The Stripe `capture` call has `idempotencyKey: complete_capture_${bookingId}_v${version}` so Stripe will dedupe, but the second invocation will then update the DB twice and may insert a duplicate transaction row (the UPDATE-then-INSERT fallback at line 803-816 races).

**Fix:** call `lock_booking_for_payment` in `complete-and-capture` like the other mutating actions do. Also `JobActions.handleCompleteAndCapture` already guards with `completing` state — keep, but server lock is still required.

### H2. Old PaymentIntent is never cancelled after `requires_customer_action`
In `payment-engine.recalculate` when `needsCustomerAction === true` (line 419-450), the response returns `client_secret`, **but the old PI is left active**. Then `finalize-reauthorization` (line 985-1099) cancels the old PI on success.

Edge case: customer abandons the popup. Now the booking still points to old PI (good — capture still works on the old amount), but we created a "pending" new PI in Stripe that is never cancelled and never finalized. This:
- Pollutes the Stripe dashboard.
- May trip Stripe's "too many open PIs" anti-fraud checks for that customer.
- The new PI will eventually `requires_payment_method` → harmless, but messy.

**Fix:** add a `pending_reauth_payment_intent_id` column to `bookings`, write the new PI ID there in the `requires_customer_action` branch, and on the next `recalculate` / on `worker-cancel-booking` / on a cron sweep, cancel any stale pending PI > N minutes old.

### H3. `lower amount` no-op path mutates `transactions` without `payment_version`-based idempotency key
`payment-engine.recalculate` lines 282-318: when expectedCents < currentPI.amount, the code updates the `authorized` transaction row but never bumps `payment_version`. Two simultaneous "remove service" operations can both pass the lock-check window and both decrement, racing on `transactions.amount`. The `lock_booking_for_payment` RPC is called (line 250) so the lock guards this; verify the lock function is `FOR UPDATE` on the bookings row. Cite needed: `supabase/migrations/20260215080033_28cdfc56-6d9c-405e-ac4c-f44a2c2938a2.sql` — confirm body locks the booking row.

### H4. `payment-engine` action canonicalization bug
Line 45-46:
```ts
const canonicalAction = action === 'modify-authorization' ? 'recalculate' : action;
payload.action = canonicalAction;
```
But the dispatcher then uses `if (action === 'authorize')`, `if (action === 'recalculate')`, `if (action === 'capture')`, etc. — using the raw `action` variable, not `canonicalAction`. Only `finalize-reauthorization` uses `canonicalAction`. Result: callers passing `action: 'modify-authorization'` will not match any branch and fall through to the `Unknown action` throw.

**Fix:** replace every `if (action === 'X')` with `if (canonicalAction === 'X')`, OR reassign `action = canonicalAction`.

### H5. `add-booking-services` rolls back on `requires_customer_action` paths it shouldn't
Lines 99-110:
```ts
if (engineError || !engineResult?.success) { rollback... throw }
```
The engine returns `success: true, action: 'requires_customer_action'` for the 3DS path, so this branch correctly skips rollback. ✅ Already fixed.

But: if the customer abandons the Stripe popup, the inserted `booking_services` rows remain and the booking's `authorized_amount` (still the old amount) does not cover them. The next `complete-and-capture` will then throw `Final amount $X exceeds authorized $Y`. There is no cleanup path.

**Fix:** add a "Cancel pending services" UX in the modal `onClose` that hard-deletes the just-added services if `finalize-reauthorization` was never called. Or persist a `pending_service_ids` linkage to the pending PI and revert on cancel.

### H6. `usePaymentProcessing.tsx` (cash payment path) writes booking directly
File: `src/components/worker/payment/usePaymentProcessing.tsx` lines 42-55 — for cash, it calls `recordCashPayment` then directly UPDATEs `bookings.pending_payment_amount = 0` from the client. That update will trigger the new `enforce_completed_requires_capture` only if `status='completed'` — safe today, but it bypasses the unified path. The cash branch never sets `payment_status = 'captured'`, never sets `status = 'completed'`, never archives. So a cash-paid job remains "authorized" forever and the worker still has to press the unified button which will then try to capture from Stripe → fails (`payment_status is pending` or whatever).

**Fix:** make cash payments go through a dedicated `payment-engine` action (`record-cash-payment`) that sets `payment_status='captured'`, archives, and writes the transaction. Then the unified button's idempotent path (line 698 — already-captured short-circuit) finishes the job.

---

## 4. Medium-priority issues

### M1. `complete-and-capture` allows `status === 'payment_authorized'` but the `enforce_completed_requires_capture` trigger will pass that fine. ✅ OK. But note `payment-engine.authorize` sets `status: 'confirmed'` (line 200), not `payment_authorized`. There are two parallel status models in the codebase — old triggers (`20250731170331…`) auto-transition to `payment_authorized` via transaction inserts. If those triggers still exist and fire after `payment-engine.authorize`, you'll have racey status flipping. Verify whether the legacy triggers were dropped.

### M2. `_shared/stripe.ts` — Stripe API version is pinned to `2024-12-18.acacia`. That version is supported, but be aware that `paymentIntents.cancel` of a PI in `requires_action` returns 200 with `cancellation_reason: 'abandoned'`. Code handles this, but `worker-remove-services` doesn't pass a `cancellation_reason` argument shape that matches Stripe's typing in newer SDK versions — currently OK with 17.5.0.

### M3. `unified-payment-status-sync` (referenced by `tests/e2e/payment_flow.spec.ts`) is not in the function list. The e2e tests will 404. Either add the function or update the tests.

### M4. `transactions` table updates use `.eq('status', 'authorized')` without selecting first — if a previous capture left two `authorized` rows (legacy data), the engine will update both. The `.update().select('id')` in `complete-and-capture` only verifies non-empty array. Add a safety `LIMIT 1` via PostgREST is not possible — use `.eq('idempotency_key', ...)` instead, or take the `id` first via SELECT.

### M5. CORS mismatch across functions
`payment-engine` uses the shared `corsHeaders` (good). `worker-remove-services` defines its own and lists fewer headers. If the frontend ever sends `x-supabase-client-platform`, preflight from `worker-remove-services` will fail. Standardize on the shared header.

### M6. `JobActions.tsx` `canCompleteAndCapture` does not include `requires_manual_payment` check beyond `!job.requires_manual_payment`. ✅ Good. But the green button is shown even when the booking has a pending re-authorization (`pending_payment_amount` > 0 with old PI still active). Worker pressing it will succeed at capturing the OLD amount — *not* the new total. Add `!job.pending_payment_amount` to the guard.

---

## 5. Low-priority cleanup

- `payment-engine/index.ts` mixes `Deno.serve` (line 26) with the import-style serve used everywhere else. Consistent style please.
- `add-booking-services` reads `booking.booking_services` from the SELECT but the `priceMap` already excludes existing services — fine, but `currentTotal` on line 118 uses pre-insert services only, which is correct for the email but confusing.
- Many `console.log` payloads stringify the entire payload — strip Stripe `client_secret` before logging.
- `repair-tip-calculations`, `stripe-transactions-sync`, `sync-stripe-captures`, `sync-payment-after-modification`, `unified-payment-authorization`, `unified-payment-verification`, `confirm-payment`, `create-payment-intent`, `cancel-payment-intent`, `charge-saved-payment-method` — verify which still call Stripe directly. If any remain, they violate the "payment-engine is the only Stripe authority" rule. Consider deleting or routing through the engine.
- `tests/e2e/payment_flow.spec.ts` references endpoints that don't exist (`unified-payment-status-sync`, `sync-payment-transactions`, `test-e2e-booking-capture`). Delete or implement.

---

## 6. Files involved (must-fix)

| Issue | File | Lines |
|---|---|---|
| C1 | `src/components/worker/JobActions.tsx` | 74-77 |
| C1 (audit other call sites) | `src/components/worker/AddServicesModal.tsx`, `src/hooks/usePaymentProcessing.tsx`, `src/hooks/useStripePayment.tsx`, all `RemoveServicesModal.tsx`, `OnSiteChargeModal.tsx` | grep `functions.invoke` |
| C2 | `supabase/functions/worker-remove-services/index.ts` | 232, 254 |
| C3 | `src/components/worker/JobActions.tsx` + new logic in `payment-engine` | 54, 716-728 |
| H1 | `supabase/functions/payment-engine/index.ts` | 681-693 |
| H2 | `supabase/functions/payment-engine/index.ts` + migration | 419-450 + new column |
| H4 | `supabase/functions/payment-engine/index.ts` | 97, 242, 579, 681, 851 |
| H5 | `src/components/worker/AddServicesModal.tsx` + `add-booking-services` | 401-420 |
| H6 | `src/components/worker/payment/usePaymentProcessing.tsx` + new engine action | full file |

---

## 7. Code-level fixes (pseudocode)

**C1 — every functions.invoke that hits the payment engine:**
```ts
const { data: { session } } = await supabase.auth.getSession();
const headers = { Authorization: `Bearer ${session?.access_token ?? ''}` };
await supabase.functions.invoke('worker-complete-and-capture', { body, headers });
```

**H1 — add lock to complete-and-capture:**
```ts
const { data: lockData, error: lockError } = await supabase.rpc(
  'lock_booking_for_payment', { p_booking_id: bookingId }
);
if (lockError) throw new Error(lockError.message);
const booking = lockData?.[0];
if (!booking) throw new Error('Booking not found');
// then proceed with existing checks
```

**H4 — fix action dispatch:**
```ts
const action = (payload.action === 'modify-authorization') ? 'recalculate' : payload.action;
// then use `action` everywhere, drop `canonicalAction`
```

**H6 — frontend guard:**
```ts
const canCompleteAndCapture =
  ['confirmed','in_progress','payment_authorized'].includes(job.status) &&
  job.payment_status === 'authorized' &&
  !!job.payment_intent_id &&
  !job.requires_manual_payment &&
  !job.pending_payment_amount;       // NEW
```

**H5 — abandon-popup cleanup:**
- `ReauthorizePaymentDialog.onClose`: if dialog closed without success, call new engine action `cancel-pending-reauth` that cancels the new PI in Stripe and rolls back the inserted services using `pending_service_ids` stored on the booking.

---

## 8. Test checklist (manual + e2e)

Pre-prod test matrix using Stripe test cards:

1. **Happy path no modifications**
   `4242 4242 4242 4242` → authorize → worker complete → expect captured at original amount, archived.

2. **Add service, off-session re-auth succeeds**
   `4242…` → authorize → worker adds service → expect engine `action=reauthorized`, new PI, old PI cancelled → complete → captured at new total.

3. **Add service, 3DS required**
   `4000 0027 6000 3184` → authorize → worker adds service → engine returns `requires_customer_action` → ReauthorizePaymentDialog → confirm card → finalize-reauthorization → complete → captured at new total. **Verify: old PI cancelled, transaction rows consistent.**

4. **Add service, 3DS abandoned**
   Same as #3 but close the dialog without confirming. **Expected after H5 fix: services rolled back, booking unchanged.** Currently: services remain, `complete-and-capture` will throw exceeds-authorization.

5. **Remove service pre-capture**
   Authorize $200 → remove $50 service → engine returns `no_op_lower_amount` → complete → captured at $150 (Stripe releases $50). **Verify with Stripe Dashboard.**

6. **Remove all services pre-capture**
   Should hit zero-total branch → PI cancelled → booking `payment_status='cancelled'` → unified button hidden → "Collect Payment" shown.

7. **Double-click `Complete Job & Accept Payment`**
   Two rapid clicks. Expect: one capture, one row in transactions, no duplicate. After H1 fix.

8. **Worker not assigned tries complete**
   Use a different worker's session token → engine returns `Access denied`.

9. **Frontend without Bearer**
   Inspect network tab during complete — confirm `Authorization: Bearer eyJ…` header is sent.

10. **DB trigger:** manually try `UPDATE bookings SET status='completed' WHERE payment_status='authorized'` → should raise `check_violation`. ✅ Implemented.

11. **Test/live mode safety:** flip `app_settings.stripe_mode` to `test`, retry #1; confirm `STRIPE_SECRET_KEY_TEST` is used and no live charges.

12. **Cash payment:** worker collects cash → currently leaves booking unfinalized. After H6 fix, complete should succeed without Stripe call.

---

## 9. Final verdict

**Not production-ready** — but you are 1-2 hours of focused work away.

Blockers (must ship with):
- C1 (Bearer header on the unified button) — without this, every worker click will fail with `Authorization required`.
- C3 (recoverable `requires_manual_payment` state) — workers will get stuck.
- H1 (lock in complete-and-capture) — financially material race.
- H4 (action dispatch using raw vs canonical) — `modify-authorization` callers break silently.

Should ship with:
- H2/H5 cleanup of orphaned PIs and services on abandon.
- H6 frontend guard against capturing old-amount during pending re-auth.

Can ship after:
- Cash flow refactor (H6/M-cash).
- Legacy function audit (M-low cleanup).
- Test suite repair.

Approve this plan and I will implement C1, C3, H1, H4, H5, H6 in the codebase, regenerate the migration for the pending-PI tracking column, and update the worker dashboard guards. Cash-flow refactor and legacy function purge will be a follow-up PR.
