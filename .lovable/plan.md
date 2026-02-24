

# Fix: Server-Side Tiered Pricing in create-guest-booking

## The Problem

The `create-guest-booking` edge function fetches only `base_price` from the `services` table (line 152) and uses it to override the frontend's calculated price. For tiered services like "Mount TV", the flat `base_price` is $90 (1 TV price), but 2 TVs should cost $170 ($90 + $80). The server blindly stores $90, and then the payment engine authorizes based on that incorrect stored value.

## What Changes

**One file**: `supabase/functions/create-guest-booking/index.ts` (lines 148-167)

### Current Code (Broken)
```typescript
const { data: officialServices } = await supabaseClient
  .from('services')
  .select('id, base_price')
  .in('id', serviceIds);

const priceMap = new Map(officialServices?.map(s => [s.id, Number(s.base_price)]) || []);

const serviceInserts = services.map((service: any) => ({
  booking_id: booking.id,
  service_id: service.id,
  service_name: service.name || 'Unknown Service',
  base_price: priceMap.get(service.id) ?? service.price ?? 0,
  quantity: service.quantity || 1,
  configuration: service.options || {},
}));
```

### Fixed Code
1. Fetch `pricing_config` alongside `base_price` from the `services` table
2. For services with `pricing_type: 'tiered'`, extract the TV count from the service name (e.g., "Mount TV (2 TVs)") and calculate the correct tiered total using `pricing_config.tiers`
3. For non-tiered services, continue using the flat `base_price` as before (no behavior change)

### Also Fix: `payment-engine/index.ts` refund-difference action (lines 571-590)

The `refund-difference` action has the same pattern -- it fetches flat `base_price` to calculate refund amounts for removed services. If a tiered service like "Mount TV (2 TVs)" is removed, it would refund $90 instead of $170. Apply the same tiered-aware pricing logic here.

The `authorize`, `recalculate`, `capture`, and `charge-difference` actions do NOT need changes -- they all use `getServicesTotal()` which reads from `booking_services` (already stored values), so fixing the storage in `create-guest-booking` fixes the entire downstream chain.

## How Tiered Calculation Works Server-Side

```text
1. Fetch service record with pricing_config
2. Check if pricing_config.pricing_type === 'tiered'
3. If yes:
   a. Extract TV count from service name: "Mount TV (2 TVs)" -> 2
   b. Also check service.quantity from the frontend payload as fallback
   c. Iterate through pricing_config.tiers:
      - TV 1: find tier with quantity=1 -> $90
      - TV 2: find tier with quantity=2 -> $80
      - Total: $170
   d. For quantities beyond defined tiers, use the tier marked is_default_for_additional
4. If not tiered: use base_price (current behavior, unchanged)
```

## Fallback Safety

If the name regex fails or `pricing_config` is missing, the code falls back to `base_price` -- identical to today's behavior. No new failure modes are introduced.

## Steps

1. Update `create-guest-booking/index.ts` lines 148-167 to fetch `pricing_config` and calculate tiered prices
2. Update `payment-engine/index.ts` lines 571-590 (refund-difference) with same tiered pricing awareness
3. Redeploy both edge functions
4. No database changes needed
5. No frontend changes needed

## What This Does NOT Do

- Does not touch Sterling Berkhalter's booking
- Does not change any frontend code
- Does not change how non-tiered services are priced
- Does not affect the authorize/capture/recalculate actions (they read from booking_services which will now be correct)

