
# Root Cause: `booking_id=eq.undefined` in Admin Dashboard

## The Exact Failure Chain

The bug is caused by **three cooperating problems** across two files. Here is the complete execution path that produces `booking_id=eq.undefined`.

---

### Step 1 — Supabase Realtime fires a DELETE event

When a booking is deleted (e.g., bulk-delete of `payment_pending` bookings), Supabase Realtime sends a payload shaped like this:

```text
{
  eventType: 'DELETE',
  new: {},          <-- EMPTY object, no id
  old: { id: '...', ... }
}
```

For a **DELETE** event, Supabase puts the booking data in `old`, and `new` is always `{}`.

---

### Step 2 — `useRealtimeBookings.tsx` line 161 passes the wrong record

Look at this line:

```text
// line 161 in useRealtimeBookings.tsx
onBookingUpdate(newRecord || oldRecord, reassignmentInfo);
```

`newRecord` is `{}` — a **truthy empty object**. So `newRecord || oldRecord` evaluates to `{}` (the empty object), **never falling through to `oldRecord`**.

The callback fires with an empty `{}` object as `updatedBooking`.

---

### Step 3 — `useBookingManager.tsx` `handleBookingUpdate` receives `{}` and fires queries

```text
// line 367-378 in useBookingManager.tsx
const handleBookingUpdate = async (updatedBooking: any) => {
  const enrichedBooking = await enrichSingleBooking(updatedBooking);

  // Line 378: updatedBooking.id is UNDEFINED here
  const { data: bookingServicesData } = await supabase
    .from('booking_services')
    .select(...)
    .eq('booking_id', updatedBooking.id);  // <-- undefined!
```

And again at line 394:

```text
  const { data: txData } = await supabase
    .from('transactions')
    .select(...)
    .eq('booking_id', updatedBooking.id);  // <-- undefined again!
```

Both `.eq('booking_id', undefined)` calls are sent to the API as `booking_id=eq.undefined`, producing **400 errors**.

---

### Why it also fires for UPDATE events sometimes

For UPDATE events, `new` contains the full new row, so `new.id` is normally present. However, there is a secondary trigger: the `transactions-admin` realtime channel inside `useBookingManager.tsx` (lines 453-481) fires on `transactions` table changes and calls `setBookings`. This does NOT call `handleBookingUpdate`, so it is NOT related to this bug.

The DELETE case is the primary trigger. The `handleBulkDeletePaymentPending` button (visible in the admin UI) deletes many bookings at once, which fires many DELETE payloads in rapid succession — which is exactly why you see the errors in bursts.

---

### Secondary Trigger: also happens for INSERT events

For an **INSERT** event:

```text
{
  eventType: 'INSERT',
  new: { id: 'abc', ... },  <-- has id, fine
  old: {}                    <-- empty
}
```

This works fine. INSERT is not a problem.

---

## Summary of Root Causes

| # | Location | Problem |
|---|---|---|
| 1 | `useRealtimeBookings.tsx` line 161 | `newRecord \|\| oldRecord` uses `newRecord` even when it is `{}` (truthy empty object), discarding the `old` record which has the actual data for DELETE events |
| 2 | `useBookingManager.tsx` line 367 | `handleBookingUpdate` has no guard for missing `updatedBooking.id` before firing sub-queries |
| 3 | `useBookingManager.tsx` line 378 & 394 | Two `.eq('booking_id', updatedBooking.id)` calls fire unconditionally even when `id` is `undefined` |

---

## The Fix (Two Changes)

### Fix 1 — `useRealtimeBookings.tsx` line 161: Check object has data

Replace:
```text
onBookingUpdate(newRecord || oldRecord, reassignmentInfo);
```

With:
```text
const recordToPass = (newRecord && newRecord.id) ? newRecord : oldRecord;
if (recordToPass?.id) {
  onBookingUpdate(recordToPass, reassignmentInfo);
}
```

This correctly uses `oldRecord` for DELETE payloads (which have a real `id`), and skips the callback entirely if neither record has an id.

### Fix 2 — `useBookingManager.tsx` line 367: Add an early guard

Add at the very top of `handleBookingUpdate`:
```text
const handleBookingUpdate = async (updatedBooking: any) => {
  if (!updatedBooking?.id) {
    console.warn('handleBookingUpdate received booking without id, skipping', updatedBooking);
    return;
  }
  // ... rest of function
```

This is a defensive safety net even after Fix 1, ensuring no downstream query ever receives `undefined` as a booking ID.

---

## Files to Change

- `src/hooks/useRealtimeBookings.tsx` — line 161 (primary fix)
- `src/hooks/useBookingManager.tsx` — line 367 (defensive guard)

No database changes, no edge function changes, no migrations required.
