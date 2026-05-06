
## What works today

Admin edits go through `ServiceModal` → `useServicesData.updateService` → `services` table (`base_price` + `pricing_config`). The frontend listens to a realtime subscription in `ServicesCacheContext`, so any UPDATE on `services`:

- clears the localStorage cache (`services_cache_v1`)
- refetches and re-renders the homepage, the TV Mounting modal (`useTvMountingModal`), and the Worker "Add Services" modal — all of which read from `useServicesCache()`

Server-side, `payment-engine` re-reads official `base_price` and `pricing_config.tiers` from the DB before authorizing/capturing, so a stale frontend price is rejected and replaced with the official price.

So the **happy path is safe**: admin changes a price → realtime push → all open browsers refresh → next booking uses the new price → server validates again.

## What is broken or risky

Three concrete places where admin edits are silently ignored or only partially applied:

### 1. `src/utils/pricing.ts` — hardcoded add-on prices

```
if (config.over65)    price += 25;   // hardcoded
if (config.frameMount) price += 40;  // hardcoded
if (special wall)      price += 40;  // hardcoded
if (config.soundbar)   price += 40;  // hardcoded
```

This is used by `RemoveServicesModal` and `calculateBookingTotal`. If admin raises "Over 65" to $30, removals/recalcs still subtract $25 — the captured amount drifts from the authorized amount and breaks the payment-integrity rule.

### 2. `src/components/worker/EnhancedInvoiceModificationModal.tsx` lines 53–58

```
if (config.over65) price += 50;     // never matched DB ($25)
if (config.frameMount) price += 75; // never matched DB ($40)
if (config.soundbar) price += 30;   // never matched DB ($40)
```

These have always been wrong and become more wrong every time admin edits.

### 3. `src/constants/fallbackServices.ts` — frozen snapshot

Hardcoded `base_price: 90`, `add_ons: { over65: 25, frameMount: 40, ... }` and hardcoded UUIDs. Used when the network is slow on first paint. After an admin price change, a brand-new visitor with cold cache and slow network briefly sees the old price; if they click through fast, the cart price disagrees with what the server later authorizes → confusing UX.

### 4. Two sources of truth for add-on prices

The same add-on price lives in **two rows**:
- `services."Mount TV".pricing_config.add_ons.over65 = 25`
- `services."Over 65\" TV Add-on".base_price = 25`

Admin has to remember to edit both. `PricingEngine.getAddOnPrice` already detects and logs the mismatch but does not fix it. If admin only edits one, frontend uses one number and the worker add-services flow uses the other.

### 5. Name-based service lookup

Many call sites do `services.find(s => s.name === 'Mount TV')` / `'Over 65" TV Add-on'` / `'Brick/Steel/Concrete'` / `'Mount Soundbar'`. If admin renames a service in the UI, every lookup silently returns `undefined` and we fall back to hardcoded prices.

## Proposed fix (surgical, no breaking changes)

### A. Remove hardcoded prices, derive everything from `useServicesCache()`

1. Refactor `src/utils/pricing.ts` into a function that takes the live services list (or a price map) and computes line totals from it. Update `RemoveServicesModal` to pass the cached services in. No more literal `25 / 40 / 40 / 40`.
2. Fix `EnhancedInvoiceModificationModal.tsx` the same way — replace the `+= 50/75/30` block with `PricingEngine.getAddOnPrice(...)` calls already used by the booking flow.

### B. Single source of truth for add-on prices

Add a DB trigger (`services_sync_addon_prices`) that runs on UPDATE of `services`:
- when the `Mount TV` row's `pricing_config.add_ons.{key}` changes, it updates the matching standalone add-on service's `base_price`
- and vice versa
This keeps both rows in lockstep no matter which one the admin edits, and removes the mismatch warnings the engine currently logs.

### C. Lookup by stable key, not by display name

Introduce a `slug` (or reuse `id`) constant map in `src/constants/serviceIds.ts`:

```
export const SERVICE_IDS = {
  mountTv:      'a50013bc-…',
  over65:       '81194c48-…',
  frameMount:   '1b47852d-…',
  specialWall:  'b86fda8c-…',
  soundbar:     '41ec18d4-…',
};
```

Replace every `find(s => s.name === '…')` in `useTvMountingModal`, `TvAddOns`, `WallTypeSelector`, `RemoveServicesModal`, `EnhancedInvoiceModificationModal` with `find(s => s.id === SERVICE_IDS.x)`. Renaming in admin can no longer break pricing.

### D. Cache-version bump on price change

Bump `CACHE_KEY` in `ServicesCacheContext` to `services_cache_v2` and add a `version` field. The realtime subscription already invalidates open tabs; the version bump ensures any returning visitor with a stale localStorage entry from before this fix discards it once.

### E. Admin guardrails (small UI additions)

- In `ServiceModal`, show a yellow banner "Renaming this service may affect booking flow" when `name` is changed for one of the known SERVICE_IDS.
- In the existing pricing-mismatch monitor (already wired via `PricingEngine.validateAllPricing`), surface mismatches in the Admin dashboard instead of console-only.

### F. Server-side defense already in place — keep it

`payment-engine` already re-reads `pricing_config.tiers` and `base_price` from DB at authorization time. We will add the same official lookup for add-ons (currently it only re-validates the base/tier price). This guarantees that even if an old browser cached old add-on prices, the captured charge always reflects the current admin price.

## Files touched

- `src/utils/pricing.ts` — remove hardcoded add-ons; accept services list
- `src/components/worker/RemoveServicesModal.tsx` — pass services list
- `src/components/worker/EnhancedInvoiceModificationModal.tsx` — use PricingEngine
- `src/hooks/useTvMountingModal.tsx`, `TvAddOns.tsx`, `WallTypeSelector.tsx` — id-based lookup
- `src/constants/serviceIds.ts` — new
- `src/constants/fallbackServices.ts` — keep but mark as last-resort only
- `src/contexts/ServicesCacheContext.tsx` — bump cache key
- `src/components/admin/ServiceModal.tsx` — rename warning banner
- `supabase/functions/payment-engine/index.ts` — re-read add-on prices from DB
- New migration: trigger to sync `Mount TV.pricing_config.add_ons` ↔ standalone add-on `base_price`

## Result

- Admin changes any price (base, tier, or add-on) in one place → trigger syncs the partner row → realtime push refreshes every open browser → TV mounting modal, worker Add/Remove/Modify, and server capture all use the new price within a second.
- Renaming a service no longer breaks lookups.
- Hardcoded fallbacks remain only as a last-resort offline shim and are guaranteed to be re-validated by the server before any money moves.

Approve and I'll implement.
