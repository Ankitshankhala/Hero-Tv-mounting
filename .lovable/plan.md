

# Fix: "Unable to Load Services" Error

## Root Cause

The Supabase client is experiencing **auth token lock timeouts** (visible in console: `lock:sb-ggvplltpwsnvtcbpazbe-auth-token timed out waiting 10000ms`). When this happens, ALL Supabase requests fail with "Failed to fetch", including the public services query. After 3 retries (with exponential backoff), the `usePublicServicesData` hook gives up and shows the "Unable to Load Services" error screen.

The services data is fine in the database (20 services exist, RLS policies are correct for public read). This is a **client-side network/auth issue**, not a data issue.

## The Problem

`usePublicServicesData` (used by `ServicesSection`) has **zero fallback** -- when network fails, users see a dead page. Meanwhile, `ServicesCacheContext` already has fallback data from `fallbackServices.ts`, but it's not being used by the services display.

## The Fix

### 1. Add fallback services to `usePublicServicesData` hook

**File: `src/hooks/usePublicServicesData.tsx`**

When all retries are exhausted, instead of showing an error with empty services, fall back to the cached/hardcoded services data from `ServicesCacheContext` or `fallbackServices.ts`. This ensures users always see services even when the network is down.

Changes:
- Import `getFallbackServicesArray` from `@/constants/fallbackServices`
- In the error handler (after all retries exhausted), check localStorage cache first, then use hardcoded fallbacks
- Set services to fallback data instead of empty array
- Change the error state to a warning (services shown but may be stale) instead of a blocking error

### 2. Use `ServicesCacheContext` in `ServicesSection` as primary source

**File: `src/components/ServicesSection.tsx`**

Instead of using `usePublicServicesData` (which fetches independently), use the `useServicesCache` hook from `ServicesCacheContext`. This context:
- Initializes immediately from localStorage cache or fallback data
- Fetches fresh data in the background
- Has real-time subscription for updates
- Never shows an empty/error state on first load

Changes:
- Replace `usePublicServicesData()` with `useServicesCache()` 
- Use `publicServices` from the cache context (already filtered by `is_visible`)
- Remove redundant error/retry UI since cache always has data
- Keep the loading skeleton only for the brief moment before cache initializes (rare)

### 3. Improve Supabase client auth resilience

**File: `src/integrations/supabase/client.ts`**

Add auth configuration to reduce lock timeout issues:
- Set `lock` timeout to a shorter value
- Add `persistSession: true` and `detectSessionInUrl: true` explicitly
- Set `flowType: 'pkce'` for better auth handling

## Technical Details

| File | Change |
|---|---|
| `src/components/ServicesSection.tsx` | Switch from `usePublicServicesData` to `useServicesCache` for fallback-aware data |
| `src/hooks/usePublicServicesData.tsx` | Add fallback services when all retries fail instead of empty array |
| `src/integrations/supabase/client.ts` | Add auth config to reduce lock timeout issues |

## Impact

- Users will **always** see services on the homepage, even with network issues
- Fallback data may be slightly stale but services/prices rarely change
- No database changes needed
- No edge function changes needed
- The "Unable to Load Services" error screen will only appear if both network AND cache AND fallback all fail (virtually impossible)

