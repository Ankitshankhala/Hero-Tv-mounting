

# Fix: Mount TV Tiered Pricing Not Working

## Root Cause

The Mount TV service in the database has `pricing_config = NULL`. The tiered discount pricing (1st TV: $90, 2nd TV: $80, 3rd+: $70) and add-on price mappings only exist in the hardcoded fallback file (`fallbackServices.ts`), **not in the database**.

When the app loads:
1. Fallback data is used initially (has pricing_config with tiers) -- discounts work briefly
2. Live database fetch completes and replaces fallback data (pricing_config is NULL) -- discounts stop working
3. `calculateTvMountingPrice()` falls back to `base_price * quantity` = $90 per TV with no discount

## Fix: Populate pricing_config in the Database

### Step 1 - Database Migration

Run a SQL migration to set `pricing_config` on the Mount TV service row:

```sql
UPDATE services 
SET pricing_config = '{
  "pricing_type": "tiered",
  "tiers": [
    {"quantity": 1, "price": 90},
    {"quantity": 2, "price": 80},
    {"quantity": 3, "price": 70, "is_default_for_additional": true}
  ],
  "add_ons": {
    "over65": 25,
    "frameMount": 40,
    "soundbar": 40,
    "specialWall": 40
  }
}'::jsonb
WHERE id = 'a50013bc-ee03-4452-b3ec-1683094d787a' AND name = 'Mount TV';
```

This single migration is the complete fix. No code changes needed -- the existing `calculateTvMountingPrice()` function and `PricingEngine` already correctly read from `pricing_config` when it's present.

### Why No Code Changes Are Needed

The code in `useTvMountingModal.tsx` line 48-65 already handles this correctly:
```
const pricingConfig = tvMountingService?.pricing_config;
if (pricingConfig?.tiers) {
  // Uses tiered pricing -- this path works when pricing_config exists
}
// Falls back to base_price * quantity when pricing_config is null
```

The only problem is the data, not the code.

## Files Changed

| File | Change |
|---|---|
| New SQL migration | `UPDATE services SET pricing_config = ...` for Mount TV |

## Result After Fix

- 1st TV: $90
- 2nd TV: $80 (discount)
- 3rd+ TV: $70 each (discount)
- Add-on prices (over65: $25, frameMount: $40, soundbar: $40, specialWall: $40) consistently sourced from DB
- Works immediately on load AND after DB fetch completes

