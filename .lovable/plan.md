# Bookings anon-read scoping — design plan

## Findings (confirmed)

1. **Probe is not auth-branched.** `EnhancedInlineBookingFlow.tsx:115–151` runs the `.from('bookings').select('id, payment_status, status').eq('id', pendingBookingId)` probe on mount for any visitor with a `pendingBookingId` in sessionStorage. For logged-in customers the request is sent with their JWT and resolves under the `authenticated` policy — no code change needed to gate it.
2. **Logged-in bookings have `customer_id = auth.uid()`.** `useBookingOperations.ts:309,371` — authenticated users insert directly; guests (`!user`) route through the `create-guest-booking` edge function which sets `customer_id: bookingData.customer_id || null`. The existing `Customers can view own bookings` policy (`customer_id = auth.uid()`) fully covers logged-in customers.
3. **`reservation_expires_at` exists** (timestamptz, set to `now() + 15 min` at insert, both in client path and edge function). No `reservation_token` / nonce column exists today.
4. **Current anon SELECT policy is too broad:** `(customer_id IS NULL AND status='payment_pending') OR (customer_id IS NULL AND payment_intent_id IS NOT NULL)` — unbounded in time, unbounded across sessions, and the second clause survives long after checkout completes.

## Design decision

Adopt **Option A: narrow by time + status, no nonce**. Rationale:
- Zero frontend change, no schema migration, immediate risk reduction.
- Guest reads are already keyed by `id` (a v4 UUID) held only in the guest's own `sessionStorage` — effectively an unguessable capability.
- The 15-min `reservation_expires_at` window matches the actual checkout lifetime; anything older is stale and shouldn't be readable anon.

Option B (add `guest_session_token` column + require it as a filter) is stronger but requires schema + frontend changes across guest booking creation, sessionStorage, and probe. Deferred unless the security scanner or a threat model demands it.

## Policy to apply (single migration, no frontend edits)

Drop the current broad policy and replace with a tight one:

```sql
DROP POLICY IF EXISTS "Enable guest booking viewing during checkout" ON public.bookings;

CREATE POLICY "Anon can view own guest booking during active checkout"
ON public.bookings
FOR SELECT
TO anon
USING (
  customer_id IS NULL
  AND status = 'payment_pending'
  AND reservation_expires_at IS NOT NULL
  AND reservation_expires_at > now()
);
```

Key differences vs current policy:
- **Role scoped to `anon`** (was `public`, which also matched authenticated — harmless but noisy).
- **Removes the `payment_intent_id IS NOT NULL` disjunct** — that clause kept rows readable indefinitely after payment authorization.
- **Adds `reservation_expires_at > now()`** — enforces the 15-min lifetime already used elsewhere.
- **Keeps `status = 'payment_pending'`** — after the row transitions to `payment_authorized`/`confirmed`, anon loses read access (frontend probe already clears sessionStorage on non-pending states).

Column exposure: no `REVOKE`/column-GRANT change needed in this migration — the probe only selects `id, payment_status, status`. If the security team wants defense-in-depth, follow up with a column-scoped `GRANT SELECT (id, status, payment_status) ON public.bookings TO anon` after `REVOKE SELECT ... FROM anon`. Flagged separately, not part of this change.

## What logged-in customers get

Nothing changes for them. Their probe uses their JWT and is served by `Customers can view own bookings` (`customer_id = auth.uid()`). Confirmed policy exists and predicate is exactly that.

## Verification after apply

1. `supabase--linter` clean.
2. Manual: guest flow in preview — create booking, reload tab within 15 min, confirm probe restores state; wait past 15 min (or manually expire), confirm probe returns null and sessionStorage clears.
3. Manual: logged-in customer flow — create booking, reload, confirm restore works (served by authenticated policy).
4. Query `pg_policies` and paste the applied policy row in the report.

## Out of scope for this change

- Adding `guest_session_token` nonce column.
- Tightening authenticated-role access to `users` PII (tracked separately from the prior worker-email diagnosis).
- Column-level GRANTs on `bookings` for anon (defense-in-depth, follow-up).
- Any frontend edits — the probe code stays as-is.
