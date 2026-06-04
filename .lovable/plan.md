## Problem

Clicking the "Mount TV" service card adds the service straight to cart instead of opening the add-on configuration modal (Over 65", Frame Mount, Wall type, Soundbar).

## Root cause

`src/components/ServicesSection.tsx` decides whether to open `TvMountingModal` by comparing the service **name** to the literal string `'Mount TV'`:

```ts
if (serviceName === 'Mount TV') {
  setShowTvModal(true);
}
```

If the service in the database was renamed (e.g. "TV Mounting", "Mount TV Service", trailing space, different casing), the name comparison fails and the code falls through to the "just add to cart" branch — exactly what the user is seeing.

The project already maintains stable UUIDs in `src/constants/serviceIds.ts` (`SERVICE_IDS.mountTv`) specifically so admin renames don't break lookups. The TV mounting hook uses it; the service card click handler doesn't.

## Fix

Switch the gate in `ServicesSection.handleServiceClick` from name match to stable ID match.

```ts
import { SERVICE_IDS } from '@/constants/serviceIds';

const handleServiceClick = (serviceId: string, serviceName: string) => {
  if (serviceId === SERVICE_IDS.mountTv) {
    setShowTvModal(true);
    return;
  }
  // ...existing add-to-cart branch
};
```

No other files need changes. The modal itself (`TvMountingModal` + `useTvMountingModal`) already works and is wired to `onAddToCart`.

## Scope

- Edit only `src/components/ServicesSection.tsx`
- No changes to pricing, cart, checkout, modal UI, or backend
