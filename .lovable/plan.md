

# Speed Up Services Loading & Remove Dark Image Overlay

## Changes

### 1. Remove the dark gradient overlay from service card images
**File: `src/components/ServiceCard.tsx`** (line 52)

The line `<div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 to-transparent" />` places a dark gradient over every service image, making them hard to see. This will be removed entirely so images display clearly.

### 2. Switch images from lazy to eager loading
**File: `src/components/ServiceCard.tsx`** (line 43)

The `loading="lazy"` attribute delays image rendering until the user scrolls near them. Since the Services section is prominently visible on the homepage, changing this to `loading="eager"` (or removing the attribute) ensures images load immediately with the page.

### 3. Set loading state to false immediately when fallback data is available
**File: `src/contexts/ServicesCacheContext.tsx`** (line 83)

Currently `isLoading` starts as `true`, which causes the skeleton loader to flash briefly even though fallback data is already loaded in the initial state (line 78-82). Changing the initial state to `false` when cache/fallback data exists eliminates the skeleton flash entirely -- services render instantly.

```
Change line 83 from:
  const [isLoading, setIsLoading] = useState(true);
To:
  const [isLoading, setIsLoading] = useState(() => {
    const cached = readCache();
    return !cached?.services && getFallbackServicesArray().length === 0;
  });
```

This means:
- If localStorage cache exists: no loading state, instant render
- If fallback data exists (always does): no loading state, instant render
- Fresh data still loads in the background and swaps in silently

## Summary

| Change | Effect |
|---|---|
| Remove dark gradient overlay | Images are clear and easy to see |
| Change `loading="lazy"` to `loading="eager"` | Images load immediately, no scroll-triggered delay |
| Initialize `isLoading` as `false` when data exists | No skeleton flash, services appear instantly |

