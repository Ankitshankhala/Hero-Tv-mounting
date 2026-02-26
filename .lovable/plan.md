

# Fix: Show Correct Service Images (Use Database URLs, Not Wrong Placeholders)

## Problem

The `getServiceImage()` function maps 45+ service names to only 6 unique local image files. These local images are generic category placeholders — they are NOT the actual photos for each service. When Supabase storage URLs load successfully, the correct images show. But whenever the `onError` fallback triggers, services get wrong images (e.g., "Custom Lighting" shows a general mounting photo, "Luxury Garden" shows a general mounting photo, etc.).

## Root Cause

The previous fix added local image mappings as fallbacks, but these mappings were assigned based on rough categories rather than actual service photos. Since these local files don't match the real service images, they make services look wrong when they appear.

## Solution

### 1. Remove the incorrect `getServiceImage()` mapping entirely
**File: `src/components/ServicesSection.tsx`**

Delete the entire `getServiceImage()` function and its 45+ wrong mappings. Instead, always use the `image_url` from the database/fallback data as the primary image source. For the fallback (when remote URLs fail), use a single generic company placeholder rather than pretending to know which image belongs to which service.

Changes:
- Remove the `getServiceImage()` function (lines 11-65)
- Change `image` prop to use `service.image_url` directly (with a single generic fallback)
- Change `fallbackImage` prop to use the generic placeholder for all services

### 2. Keep the `onError` handler in ServiceCard
**File: `src/components/ServiceCard.tsx`**

No changes needed here — the `onError` handler already correctly swaps to `fallbackImage` when the primary image fails. It just needs to receive the right fallback (a generic placeholder, not a wrong image).

## Technical Details

**Before (wrong):**
```
image={service.image_url || getServiceImage(service.name)}  // Falls back to wrong local image
fallbackImage={getServiceImage(service.name)}                // Wrong image on error
```

**After (correct):**
```
image={service.image_url || '/lovable-uploads/885a4cd2-a143-4e2e-b07c-e10030eb73c1.png'}
fallbackImage="/lovable-uploads/885a4cd2-a143-4e2e-b07c-e10030eb73c1.png"
```

This way:
- When Supabase is available: each service shows its own correct image from `image_url`
- When Supabase is down: services show a neutral generic placeholder instead of a wrong image

## Files Changed

| File | Change |
|---|---|
| `src/components/ServicesSection.tsx` | Remove `getServiceImage()`, use `image_url` directly with generic fallback |

