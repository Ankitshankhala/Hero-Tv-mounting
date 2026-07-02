# Restore Mount TV Tiered Pricing

The Mount TV service's `pricing_config` in the `services` table currently only contains `{ "pricing_type": "tiered" }` — the `tiers` array was wiped, causing every TV to fall back to a flat `$90 base_price`.

## Change

Update the `pricing_config` on the Mount TV service row (`id = a50013bc-ee03-4452-b3ec-1683094d787a`) to restore the tiers:

- 1st TV: **$90**
- 2nd TV: **$80**
- Additional TVs: **$70 each** (default for any quantity beyond tier 2)

Existing `add_ons` (over65, frameMount, soundbar, specialWall) will be preserved from the current stored config if present; otherwise left as-is. No other services touched.

## SQL (data update, not a schema migration)

```sql
UPDATE public.services
SET pricing_config = jsonb_set(
  COALESCE(pricing_config, '{}'::jsonb),
  '{tiers}',
  '[
    {"quantity": 1, "price": 90},
    {"quantity": 2, "price": 80},
    {"quantity": 3, "price": 70, "is_default_for_additional": true}
  ]'::jsonb,
  true
) || '{"pricing_type":"tiered"}'::jsonb
WHERE id = 'a50013bc-ee03-4452-b3ec-1683094d787a';
```

## Why this is enough (no code changes)

- `PricingEngine.getTierPrice` and `useTvMountingModal.calculateTvMountingPrice` already read `pricing_config.tiers` and use `is_default_for_additional` for 3+ TVs.
- `formatTieredPricing` in `src/utils/pricingDisplay.ts` already renders exactly: `1st TV: $90, 2nd TV: $80, Additional TVs: $70 each`.
- All totals, cart summaries, and checkout amounts recompute from this config automatically.
- No component, styling, layout, or logic changes required.

## Verification

After applying:
1. Re-query the row to confirm the tiers array.
2. Open the Mount TV modal in the preview: 1 TV → $90, 2 TVs → $170, 3 TVs → $240, 4 TVs → $310.

## Out of scope

- Add-on prices, other services, UI text/styles, and pricing engine code — all untouched.
- Audit/history table for `services` edits (previously discussed) is deferred.
