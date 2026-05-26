## Remove workers: Michael Davison & Connor

Found the two workers in the database matching "Michel" and "Conner":

| Name | Email | Booking history |
|---|---|---|
| michael davison | mikedbeckwith@gmail.com | 0 bookings — safe to hard delete |
| Connor | connorhperrin@yahoo.com | 43 bookings — must soft-delete to preserve history |

## Plan

Run a single safe migration that:

1. **Connor (`3e2e7780-6abd-40f5-a5a2-70286b7496de`)** — has 43 historical bookings. Hard delete would break booking/payroll/invoice FK integrity, so:
   - Set `is_active = false`
   - Set `role = 'customer'` so he no longer appears in technician lists, assignments, or availability lookups
   - Clear `worker_availability`, `worker_schedule`, and any worker coverage/zip rows for him
   - Null out `reserved_worker_id` / `preferred_worker_id` on any future (non-completed) bookings so he isn't reassigned; leave `worker_id` on historical bookings intact for reporting

2. **Michael Davison (`187dd38f-42e9-49aa-96e2-f87c46d4168c`)** — 0 bookings. Safe to:
   - Clear `worker_availability`, `worker_schedule`, coverage rows
   - Hard-delete the `users` row
   - (Auth user row in `auth.users` is left to admin to remove via dashboard if desired — deleting via SQL requires service-role and isn't done in migrations to avoid breaking auth state)

3. **Rollback safety** — Connor's data is fully recoverable (just flip `is_active` back and `role` back to `worker`). Michael's deletion is permanent but he has no dependent records.

No changes to FK constraints, RLS, payment, or worker-assignment code.

## Confirm

Please confirm these are the correct two people before I run the migration:
- **michael davison** — mikedbeckwith@gmail.com
- **Connor** — connorhperrin@yahoo.com
