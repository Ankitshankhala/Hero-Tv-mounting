

# Fix: "Unable to Load Services" on Homepage

## Root Cause

The homepage `ServicesSection` component uses `usePublicServicesData()` -- a hook with an aggressive **10-second timeout** and **no cache or fallback**. When the Supabase request takes longer than 10 seconds (cold start, slow connection, preview environment latency), every attempt gets aborted, all 4 retries fail, and the user sees "Unable to Load Services."

Meanwhile, a completely separate system -- `ServicesCacheContext` -- already exists in the app with localStorage caching AND hardcoded fallback services. But `ServicesSection` does not use it.

```text
Current architecture (broken):

ServicesCacheContext (has cache + fallbacks, works fine)
  |-- NOT used by ServicesSection

ServicesSection
  |-- usePublicServicesData() (10s timeout, no cache, no fallbacks)
  |-- All 4 attempts timeout --> "Unable to Load Services"
```

The console logs confirm this: all requests hit the 10-second abort, retry 4 times over ~40 seconds, then give up -- while `ServicesCacheContext` also fails independently with "Failed to fetch" since it's a separate parallel request.

## The Fix

**Replace `usePublicServicesData()` with `useServicesCache()` in `ServicesSection`** so it benefits from the existing cache and fallback system.

### File: `src/components/ServicesSection.tsx`

1. Replace import from `usePublicServicesData` to `useServicesCache` from `ServicesCacheContext`
2. Swap the hook call: use `useServicesCache()` instead of `usePublicServicesData()`
3. Map the returned `publicServices` to the expected shape (the fields are compatible)
4. Use `refetch` from the cache context for the retry button
5. Remove the `retryCount` and `error` state handling since the cache context always has fallback data -- the error state becomes unreachable

### What changes in behavior

| Before | After |
|---|---|
| 10s timeout, 4 retries, then error | Instant display from cache/fallback, background refresh |
| Shows skeleton loaders for 40+ seconds | Shows services immediately (cached or fallback) |
| Shows "Unable to Load Services" error | Always shows services; stale data at worst |
| Two separate fetch systems competing | Single unified fetch through ServicesCacheContext |

### File: `src/hooks/usePublicServicesData.tsx`

No changes needed. Other components (worker modals, admin panels) still use it. But `ServicesSection` -- the critical customer-facing homepage component -- will no longer depend on it.

## Technical Detail

```text
BEFORE (ServicesSection.tsx, line 5 + 32):
  import { usePublicServicesData } from '@/hooks/usePublicServicesData';
  const { services, loading, error, retryCount, refetch } = usePublicServicesData();

AFTER:
  import { useServicesCache } from '@/contexts/ServicesCacheContext';
  const { publicServices, isLoading, refetch } = useServicesCache();
  // Use publicServices instead of services throughout the component
```

The `publicServices` from `ServicesCacheContext` already filters for `is_visible === true`, matching what `usePublicServicesData` does with its `.eq('is_visible', true)` query.

Since the cache context initializes with hardcoded fallback data, the component will always have services to display -- even on first load before any network request completes.

## Scope

| File | Change |
|---|---|
| `src/components/ServicesSection.tsx` | Switch from `usePublicServicesData` to `useServicesCache`, remove error/retry UI (fallbacks prevent it), simplify loading state |

One file, minimal change, uses existing infrastructure.

