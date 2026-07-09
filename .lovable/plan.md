# Admin Bookings Table Stuck-Loading — Diagnosis (no code changes)

## TL;DR
Two overlapping bugs in `src/hooks/useBookingManager.tsx`. Not a regression from today's work — long-standing.

1. **Wrong JSON key names in Phase 1 minimal-paint** cause `customer.name = 'Loading...'` and `email/phone = ''` for every guest booking on first render.
2. **Phase 2 enrichment isn't reaching `setBookings`/`setEnriching(false)`**, so the Phase 1 placeholder state persists — worker column stays on `"Loading worker..."`, price stays on `"Updating..."`, name stays on `"Loading..."`.

## Evidence

### Where the "Loading..." string comes from
Only one place in the codebase emits `'Loading...'` as a customer name: `src/hooks/useBookingManager.tsx` line 166 (Phase-1 fast paint):

```ts
customer: booking.guest_customer_info ? {
  id: null,
  name:  (booking.guest_customer_info as any)?.customerName  || 'Loading...',
  email: (booking.guest_customer_info as any)?.customerEmail || '',
  phone: (booking.guest_customer_info as any)?.customerPhone || ''
} : null,
```

`BookingTable.tsx` line 85-95 then renders:
```ts
const getCustomerName  = (b) => b.customer?.name  || 'Guest Customer';
const getCustomerEmail = (b) => b.customer?.email || 'No email provided';
const getCustomerPhone = (b) => b.customer?.phone || 'No phone provided';
```

### DB check — the JSON keys actually stored
```sql
SELECT
  guest_customer_info->>'name'          AS name_key,
  guest_customer_info->>'customerName'  AS customerName_key,
  guest_customer_info->>'email'         AS email_key,
  guest_customer_info->>'customerEmail' AS customerEmail_key
FROM bookings WHERE guest_customer_info IS NOT NULL
ORDER BY created_at DESC LIMIT 5;
```
Result for every recent booking, including authorized `dff309fe`:
```
name_key           = 'John Drummond'         customerName_key  = NULL
email_key          = 'jdrumm9015@aol.com'    customerEmail_key = NULL
```
Every guest booking stores `name`, `email`, `phone` — never `customerName`, `customerEmail`, `customerPhone`. So Phase 1's lookup always misses and falls through to `'Loading...'` / `''`.

The empty-string email/phone explains the "inconsistency" you noticed: `''` is falsy so `getCustomerEmail` returns `'No email provided'`, while `'Loading...'` is truthy so `getCustomerName` returns `'Loading...'`. Same DB row, different fallback branches, all in Phase 1.

### Phase 2 uses the correct keys — but never runs to completion
Phase 2 (same file, lines 310-353) rebuilds `customer` with the correct dual-key fallback:
```ts
name:  (guest_customer_info)?.customerName || (guest_customer_info)?.name || 'Unknown',
email: (guest_customer_info)?.customerEmail || (guest_customer_info)?.email || 'Unknown',
```
If Phase 2 ever reached `setBookings(enrichedBookings)` (line 352) and `setEnriching(false)` (line 353), name would resolve to `"John Drummond"`, worker would render (or fall back to "Assign"), price would populate. **Neither happens** in the screenshot — worker still shows "Loading worker...", price still shows "Updating...". Both those texts are gated on `enriching === true` (BookingTable lines 325, 357). So `enriching` never flips false.

### Why Phase 2 doesn't complete
Phase 2 fires `Promise.allSettled([...4 optimizedSupabaseCall queries...])` with **no per-query timeout**. `optimizedSupabaseCall` → `canonicalDedup` wraps the Supabase call but does not enforce a timeout on the underlying network request. If any of the four queries stalls (network hiccup, PostgREST latency, or a cached-forever entry from `SimpleCache`/`canonicalDedup`), `Promise.allSettled` waits indefinitely, so:
- `setBookings(enrichedBookings)` never runs → customer name stays `"Loading..."`.
- `setEnriching(false)` never runs → `enriching` stays true → worker cell keeps `"Loading worker..."`, price keeps `"Updating..."`.

The outer `try/catch` (line 355-364) also sets `enriching=false`, but a hanging promise never throws — so the catch never fires either.

Contributing factor: the Phase 1 bookings query at line 127-137 has **no `.limit()`** despite the cache key being `bookings-recent-100`. The bookings table currently holds **150 rows**, so all 150 IDs go into the `.in('booking_id', bookingIds)` clauses in Phase 2. Still under PostgREST URL limits, but every additional booking increases the chance of one query stalling.

### Regression check
- The camelCase key mismatch in Phase 1 (`useBookingManager.tsx` line 166-168) exists in the version currently on disk. `git log` on this file isn't available in this session, but the file structure (Phase 1 fast-paint / Phase 2 enrichment pattern) is unrelated to today's `a7abd4cb` add-booking-services fix. This behavior is **long-standing**, not a fresh regression — every guest booking would have shown "Loading..." on first paint since `guest_customer_info` was standardized on lowercase keys.
- The reason it wasn't obvious before is that Phase 2 usually completes fast enough to hide Phase 1. It's now failing to complete, which unmasks the Phase 1 bug.

## Root cause (two-layer)

**Bug A — Phase 1 uses non-existent JSON keys.** `useBookingManager.tsx` lines 166-168 read `customerName / customerEmail / customerPhone` from `guest_customer_info`, but the stored keys are `name / email / phone`. Placeholder `'Loading...'` and empty strings are what render on first paint for every guest booking. Fix is trivial: mirror the dual-key fallback already used in Phase 2 (lines 327-329).

**Bug B — Phase 2 hangs, unmasking Bug A.** `Promise.allSettled` in Phase 2 has no timeout. When one of the four `optimizedSupabaseCall` queries stalls (or returns a broken cached promise from `canonicalDedup` / `SimpleCache`), Phase 2 never resolves → `setBookings`/`setEnriching(false)` never run → the UI is frozen on the Phase 1 placeholder forever. Fix requires either wrapping each sub-query with an explicit timeout (e.g. 8-10s) or bypassing the cache/dedup layer for these enrichment reads.

## Recommended fix scope (not applied yet — plan-mode only)
- **Minimum-risk fix (targets Bug A only):** change `useBookingManager.tsx` lines 166-168 to fall back through both key styles, matching Phase 2. This alone makes name/email/phone correct on first paint, even if Phase 2 later hangs.
- **Full fix (Bug A + Bug B):** additionally wrap each Phase 2 sub-query in a `Promise.race` with an ~8s timeout, so if any query stalls, the enrichment finishes with whatever data resolved and `enriching` reliably flips to false. Also add a `.limit(200)` to the Phase 1 bookings query to match the cache key intent.
- **Scope boundary:** all changes live in `src/hooks/useBookingManager.tsx` (plus optionally `src/utils/optimizedApi.ts` if we want the timeout centrally). `BookingTable.tsx` needs no changes — its fallbacks are already sensible once the data actually arrives.

Approve which scope you want and I'll implement it in a follow-up turn.
