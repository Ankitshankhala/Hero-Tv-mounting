

# Fix: Service Images Not Displaying Due to Auth Refresh Loop

## Root Cause

The browser has a **stale/expired Supabase refresh token** (`j4xsmgyp2vd6`) that is stuck in an infinite retry loop. Every ~10 seconds, the Supabase auth client tries to refresh this token and fails with "Failed to fetch." This has two cascading effects:

1. **Services data falls back to hardcoded data** -- The `ServicesCacheContext` correctly loads fallback services from `fallbackServices.ts`, so service cards still appear.
2. **Image URLs point to Supabase storage** -- The fallback data contains `image_url` values like `https://ggvplltpwsnvtcbpazbe.supabase.co/storage/v1/object/public/service-images/...`. These also fail to load because the network/auth is broken.
3. **onError fallback fires but coverage is incomplete** -- The `ServiceCard` has an `onError` handler that swaps to local `/lovable-uploads/` images via `getServiceImage()`. However, this map only covers 17 service names. Many services in the fallback data (e.g., "Buy Full Motion Mount (Living Room)", "Custom Lighting", "Luxury Accent Wall", "Luxury Deck", "Luxury Garden", "Transport TV", "Move Outlet", etc.) have no local mapping and fall through to a single generic placeholder.

## Why Images Were Previously Visible

When the Supabase connection was healthy, the app fetched services from the database and loaded images directly from Supabase storage -- both worked fine. The auth token refresh loop (likely caused by a corrupted browser session) broke ALL requests to Supabase simultaneously.

## Solution

### 1. Add auth session recovery to prevent infinite refresh loops
**File: `src/integrations/supabase/client.ts`**

Add an `onAuthStateChange` listener that detects repeated token refresh failures and automatically signs out to break the loop. This allows the app to make anonymous requests (services are public via anon key and RLS policies).

### 2. Expand `getServiceImage()` to cover ALL fallback service names
**File: `src/components/ServicesSection.tsx`**

Add local image mappings for every visible service in `fallbackServices.ts` that currently has no mapping. This ensures that when remote images fail, every card shows an appropriate local image instead of a generic placeholder.

New mappings to add:
- "Buy Full Motion Mount (Living Room)" -- use full-motion mount image
- "Buy Flat Tilt Mount (Bedroom)" -- use flat mount image
- "In-Wall Fire Safe Cable Concealment" -- use fire safe cable image
- "Custom Lighting" -- use general mounting image (closest match)
- "Luxury Accent Wall" -- use general mounting image
- "Luxury Deck" -- use general mounting image
- "Luxury Garden" -- use general mounting image
- "Distant Address Fee" -- use generic placeholder
- "Transport TV" -- use TV mounting image
- "Move Outlet" -- use general mounting image
- "Mount Soundbar" / "Mount Soundbar (Worker Only)" -- use general mounting image
- "General Mounting 15 Minutes (Worker Only)" -- use general mounting image
- "Furniture Assembly 15 Minutes (Worker Only)" -- use furniture assembly image
- All other "Worker Only" services -- use appropriate category images
- "Supersize TV" / "Supersize TV With Crew" -- use TV mounting image

### 3. Immediate user action: Clear stale browser session
The user should clear their browser's localStorage for the site (or open in incognito) to immediately resolve the auth loop. The code fix in step 1 will prevent this from happening again.

## Technical Summary

| File | Change |
|---|---|
| `src/integrations/supabase/client.ts` | Add auth error detection to auto-signout on repeated refresh failures |
| `src/components/ServicesSection.tsx` | Expand `getServiceImage()` to cover all 30+ visible service names |

## Result
- The auth refresh loop will self-heal by signing out stale sessions
- Anonymous requests will succeed for public data (services, images)
- All service cards will have proper local fallback images
- No database or edge function changes needed

