

# Fix: Service Card Images Not Loading

## Problem
When Supabase API requests fail (network issues, auth lock timeouts), the app correctly falls back to hardcoded service data. However, that fallback data contains Supabase **storage URLs** for images, which also fail to load when the network is down. The local `/lovable-uploads/` images (which would work offline) are never used because the fallback `image_url` field is not null.

## Solution

### 1. Add image error fallback in ServiceCard component
**File: `src/components/ServiceCard.tsx`**

Add an `onError` handler to the `<img>` tag that swaps to a local fallback image when the remote URL fails to load. This is the most robust fix since it handles ANY image loading failure regardless of cause.

Changes:
- Add `onError` handler on the `<img>` element
- When the remote image fails, replace `src` with a default local placeholder image (`/lovable-uploads/885a4cd2-a143-4e2e-b07c-e10030eb73c1.png`)

### 2. Expand `getServiceImage()` to cover all visible services
**File: `src/components/ServicesSection.tsx`**

The current `getServiceImage()` only maps 9 service names to local images. Many visible services (like "Cable Concealment", "In-Wall Cable Concealment", "Dismount TV", etc.) have no local mapping. Update the map to include all visible services, so when remote images fail, every service has a meaningful local fallback.

Changes:
- Add local image mappings for all visible services that currently fall through to the generic placeholder
- Pass `getServiceImage(service.name)` as a `fallbackImage` prop to `ServiceCard`

### 3. Update ServiceCard to accept a fallback image prop
**File: `src/components/ServiceCard.tsx`**

Add an optional `fallbackImage` prop so each card knows which local image to use when the primary `image` URL fails.

Changes:
- Add `fallbackImage?: string` to the props interface
- In the `onError` handler, use `fallbackImage` if provided, otherwise use the generic placeholder

## Technical Summary

| File | Change |
|---|---|
| `src/components/ServiceCard.tsx` | Add `onError` image handler + `fallbackImage` prop |
| `src/components/ServicesSection.tsx` | Pass local fallback image to each ServiceCard |

## Result
- Images always display, even during network failures
- Remote Supabase storage images load when network is available
- Local `/lovable-uploads/` images serve as automatic fallback when remote fails
- No layout shift or blank cards

