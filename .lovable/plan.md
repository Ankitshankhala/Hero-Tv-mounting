

# Backfill Missing Data on 6 Uncaptured Bookings

## Current State

| Customer | Booking ID | Stripe $ | DB Services $ | Missing Fields | Status |
|---|---|---|---|---|---|
| taelorflorence | 96be055a | $90 | $90 | `authorized_amount` | confirmed |
| ayaanasim2015 | 59ebdee5 | $215 | $215 | `authorized_amount` | confirmed |
| christiandavis727 | a0e0d2c8 | $150 | $150 | `authorized_amount`, `stripe_customer_id`, `stripe_payment_method_id` | confirmed |
| simondelagarza | 17379c9a | $90 | (unknown) | `payment_intent_id`, `authorized_amount`, `stripe_customer_id`, `stripe_payment_method_id` | completed |
| nathanevans4 | 05a1c0c7 | $366 | $265 | `authorized_amount`, `stripe_customer_id`, `stripe_payment_method_id` | completed |
| noahlangston | e888d83d | $98 | $85 | `authorized_amount`, `stripe_customer_id`, `stripe_payment_method_id` | completed |

Two bookings already have `stripe_customer_id` (taelorflorence, ayaanasim2015) -- only `authorized_amount` is missing.

Four bookings have no `stripe_customers` record at all (christiandavis727, simondelagarza, nathanevans4, noahlangston) -- these were guest checkouts with no saved customer.

## Backfill Steps

### Step 1: Backfill `authorized_amount` from Stripe amounts (all 6 bookings)

Set `authorized_amount` to the actual Stripe-authorized value so the capture action's mismatch check passes.

```text
UPDATE bookings SET authorized_amount = 90    WHERE id = '96be055a-b38e-4de1-acb9-1bef90b27f0c';
UPDATE bookings SET authorized_amount = 215   WHERE id = '59ebdee5-08e7-448d-8411-520053a208f8';
UPDATE bookings SET authorized_amount = 150   WHERE id = 'a0e0d2c8-5621-4b1d-8cea-b6e3fbbe7536';
UPDATE bookings SET authorized_amount = 90    WHERE id = '17379c9a-c4c8-4f8c-9d62-011fd0b57cd8';
UPDATE bookings SET authorized_amount = 366   WHERE id = '05a1c0c7-f337-4328-9762-ba85546f06b6';
UPDATE bookings SET authorized_amount = 98    WHERE id = 'e888d83d-bdc9-4a27-bba9-ed8768201d57';
```

### Step 2: Backfill `payment_intent_id` on simondelagarza booking

This booking has a linked transaction with the PI but the booking itself is NULL.

```text
UPDATE bookings 
SET payment_intent_id = 'pi_3T0BSICrUPkotWKC1rHs0EqA'
WHERE id = '17379c9a-c4c8-4f8c-9d62-011fd0b57cd8';
```

### Step 3: Fix transaction `base_amount` where it's 0

Four transactions have `base_amount = 0` despite having real amounts. This matters for tip/base breakdown during capture.

```text
UPDATE transactions SET base_amount = 90   WHERE booking_id = '96be055a-b38e-4de1-acb9-1bef90b27f0c' AND status = 'authorized' AND base_amount = 0;
UPDATE transactions SET base_amount = 215  WHERE booking_id = '59ebdee5-08e7-448d-8411-520053a208f8' AND status = 'authorized' AND base_amount = 0;
UPDATE transactions SET base_amount = 310  WHERE booking_id = '05a1c0c7-f337-4328-9762-ba85546f06b6' AND status = 'authorized' AND base_amount = 0;
UPDATE transactions SET base_amount = 85   WHERE booking_id = 'e888d83d-bdc9-4a27-bba9-ed8768201d57' AND status = 'authorized' AND base_amount = 0;
```

### What This Does NOT Fix

- **Missing `stripe_customer_id`** on 4 guest bookings: These customers have no record in `stripe_customers`. This only matters if you need to recalculate (add/remove services) -- it does NOT block capture. Capture uses the `payment_intent_id` directly.
- **Amount mismatches** (nathanevans4: Stripe $366 vs services $265, noahlangston: Stripe $98 vs services $85): By setting `authorized_amount` to the Stripe value, the capture check will pass. The full authorized amount gets captured, which is correct -- you should capture what Stripe holds, not recalculate from services.

### Urgency

These authorizations expire ~7 days after creation:
- Feb 11 booking expires ~Feb 18
- Feb 12 bookings expire ~Feb 19
- Feb 13 bookings expire ~Feb 20

The 3 "completed" bookings (simondelagarza, nathanevans4, noahlangston) should be captured immediately after backfill.

