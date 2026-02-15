

# Fix: Change `requires_manual_payment` Default to `false`

## Problem

The `requires_manual_payment` column on `bookings` currently defaults to `true`. This means every new booking starts assuming manual payment is needed, which is incorrect -- it should only be set to `true` when the payment engine fails to recreate a PI after canceling the old one.

## Database Migration

A single migration to fix the default and clean up any null values:

```sql
ALTER TABLE bookings ALTER COLUMN requires_manual_payment SET DEFAULT false;
UPDATE bookings SET requires_manual_payment = false WHERE requires_manual_payment IS NULL;
```

This is a data-safe change:
- Existing rows with `requires_manual_payment = true` that were intentionally set remain unchanged
- Only null values (if any) get set to `false`
- All future bookings default to `false` (the safe state)

## No Code Changes

No frontend or edge function changes are needed. The payment engine plan already sets this column to `true` only on PI creation failure, which is the correct behavior. This migration simply fixes the schema default to match that intent.

