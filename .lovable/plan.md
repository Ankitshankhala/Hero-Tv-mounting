

# Fix: worker_bookings unique constraint on reassignment

## Problem
If worker A is assigned a booking, it gets reassigned to worker B, then later reassigned back to worker A — the `INSERT` on line 144-151 fails because a row with `(booking_id, worker_id=A)` already exists (with status `reassigned`).

## Solution
Replace the `INSERT` with an `UPSERT` — use Supabase's `.upsert()` with `onConflict: 'booking_id,worker_id'`. This updates the existing row back to `assigned` + `ack_status: pending` if one exists, or inserts a new row if not.

## Change

**File:** `supabase/functions/worker-reassign-booking/index.ts` lines 143-151

Before:
```typescript
// Create new worker_bookings record
await supabase
  .from('worker_bookings')
  .insert({
    booking_id: requestData.bookingId,
    worker_id: requestData.newWorkerId,
    status: 'assigned',
    ack_status: 'pending'
  });
```

After:
```typescript
// Create or re-activate worker_bookings record (handles re-assignment to a previous worker)
await supabase
  .from('worker_bookings')
  .upsert({
    booking_id: requestData.bookingId,
    worker_id: requestData.newWorkerId,
    status: 'assigned',
    ack_status: 'pending'
  }, {
    onConflict: 'booking_id,worker_id'
  });
```

Single line change, no other files affected.

