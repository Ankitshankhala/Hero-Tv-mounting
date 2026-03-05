

# Root Cause: Workers Cannot Reassign Jobs

## The Problem

The `ReassignJobModal` calls the `worker-operations` edge function to fetch eligible workers. That function (line 58-66) runs this query:

```sql
SELECT worker_id, worker:users!worker_service_zipcodes_worker_id_fkey(id, name, email, is_active)
FROM worker_service_zipcodes
WHERE zipcode = ?
```

The join uses a **named foreign key** (`worker_service_zipcodes_worker_id_fkey`) that **does not exist** on the `worker_service_zipcodes` table. The table has only a primary key constraint -- zero foreign keys.

PostgREST returns an error like: *"Could not find a relationship between 'worker_service_zipcodes' and 'users'"*, which causes the eligible workers list to come back empty or error out. The modal shows "No eligible workers found."

**Why it worked before**: The foreign key likely existed at one point but was dropped during a migration that recreated or altered the table.

## The Fix

Two changes:

### 1. Add the missing foreign key (SQL migration)

```sql
ALTER TABLE worker_service_zipcodes
ADD CONSTRAINT worker_service_zipcodes_worker_id_fkey
FOREIGN KEY (worker_id) REFERENCES users(id) ON DELETE CASCADE;
```

### 2. Same fix for `bookings_customer_id_fkey` (verify it exists)

The same edge function also joins `bookings` with `users!bookings_customer_id_fkey`. This one appears to exist (confirmed in types.ts), so no action needed there.

### Files Changed

| File | Change |
|---|---|
| New SQL migration | Add missing FK `worker_service_zipcodes_worker_id_fkey` |

No code changes needed -- the edge function query is correct, it just needs the FK to exist in the database.

