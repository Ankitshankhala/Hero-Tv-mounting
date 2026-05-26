## Root cause

Booking creation fails for authenticated users with:

```
P0001  Cannot create booking: Invalid or missing ZIP code
hint:  Customer ZIP code is required for service coverage validation
```

The DB trigger `validate_booking_has_coverage` resolves the customer ZIP as:

```sql
customer_zip := COALESCE(
  (SELECT zip_code FROM public.users WHERE id = NEW.customer_id),
  NEW.guest_customer_info->>'zipcode'
);
```

In `src/hooks/booking/useBookingOperations.ts` the authenticated branch sets `guest_customer_info = null` and never writes the ZIP onto the `bookings` row. The trigger therefore falls back to `public.users.zip_code`, which for many accounts (including `admin@herotvmounting.com`) is `NULL` → trigger raises.

Guest bookings work because `guest_customer_info.zipcode` is populated. The ZIP validation, coverage RPC, and worker-availability RPC in client code all succeed with the cleaned ZIP — only the final insert is missing the ZIP visible to the trigger.

## Fix (minimal, frontend only)

Always pass a small `guest_customer_info` payload containing at least `{ zipcode, email, name, phone, city }` on the booking insert, for both authenticated and guest users. This gives the trigger a reliable ZIP source without changing DB triggers, RLS, or schema, and without touching the payment/Stripe/worker-assignment paths.

Additionally, as a non-blocking convenience, backfill `public.users.zip_code` for the signed-in user when it's empty so future bookings work even if the field is missing.

### Files to change

1. `src/hooks/booking/useBookingOperations.ts`
   - In `createInitialBooking`, build a shared `customerInfo` object (with the already-validated `cleanZipcode`) and set `guest_customer_info: customerInfo` for BOTH the guest and authenticated branches (not `null` for auth users).
   - After a successful authenticated booking insert, if `user` exists and their profile `zip_code` is empty, fire-and-forget `supabase.from('users').update({ zip_code: cleanZipcode, city: effectiveCity }).eq('id', user.id)`. Failure is logged but does not block.

No other files need changes. Edge function `create-guest-booking` already handles `guest_customer_info` correctly.

## Why this is safe

- Trigger logic is unchanged; we just feed it the data it already expects.
- `guest_customer_info` is a JSONB column already populated for guests, so writing it for authenticated users is structurally identical.
- Downstream consumers that read `guest_customer_info` typically gate on `customer_id IS NULL`; populating it for auth users does not change their behavior because they already branch on `customer_id`.
- No RLS, FK, payment, worker assignment, payroll, schedule, or admin code is touched.
- Rollback: revert the single hook change.

## Verification

- Authenticated booking with a valid ZIP (e.g. 10001) reaches payment step without the P0001 error.
- Guest booking still works (unchanged path).
- Console shows `[ZIP DEBUG]` with cleaned 5-digit ZIP and trigger now passes.
