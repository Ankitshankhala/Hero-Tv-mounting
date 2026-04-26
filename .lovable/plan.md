## What's broken (verified)

There are **two real bugs** — and the user's note is correct that this is a polygon-vs-polygon problem, but the good news is your project **already has the correct backend** for this. It's just not being used in one place, and the other place keeps destroying itself mid-draw.

### Bug 1 — Worker map silently returns zero ZIPs

`src/components/worker/service-area/ServiceAreaMap.tsx`, function `computeZipCodes` (line 366):

```ts
const zipCodes: string[] = []; // Database computes this
setPrecomputedZipCodes(zipCodes);
```

It's literally hardcoded to an empty array with a stale "database computes this" comment. So when a worker draws a polygon:

- The "Found ZIP codes" panel is always empty
- `requestBody.zipCodes = precomputedZipCodes` is skipped (length 0)
- The save falls back to a server path, often returning "No ZIP codes found" → `suggestManualMode` → manual fallback UI
- This matches what you're seeing: drawings don't capture the ZIPs underneath

The admin version of the same function (`AdminServiceAreaMap.tsx` line 88–139) **is correct** — it calls the existing PostGIS RPC `get_zcta_codes_for_polygon(polygon_coords)` against the `us_zcta_polygons` table. We just need to mirror that into the worker map.

### Bug 2 — Admin map tears itself down while drawing

`src/components/admin/AdminServiceAreaMap.tsx`, line 851:

```ts
}, [isActive, serviceAreas]);
```

The map-initialization `useEffect` depends on `serviceAreas`. Every time `loadServiceAreas()` runs — including right after Save, after realtime sync, or when a polygon is added — the map is unmounted and rebuilt. If admin is mid-draw, the polygon, the draw control, and the in-progress shape are all destroyed. This is the "sometimes admin can't capture" behavior.

The `serviceAreas` reference is only needed *inside* event handlers (e.g., to populate the area-selection dropdown). It does not belong in the init dependency array.

### What's NOT broken (so we don't touch it)

- PostGIS data: `us_zcta_polygons` has the polygons, RLS allows public SELECT
- RPC `get_zcta_codes_for_polygon(polygon_coords jsonb)` exists and works
- Edge function `service-area-upsert` already accepts a precomputed `zipCodes` array
- Admin's `computeZipCodes` already uses the correct GeoJSON-ring format `[[lng,lat], …, [lng,lat]]` with the polygon closed
- Coordinate order, CRS (WGS84), polygon closure — all already handled correctly on the admin side. We just copy that pattern.

## The fix

### Change 1 — Wire the worker map to the same RPC the admin uses

In `src/components/worker/service-area/ServiceAreaMap.tsx`, replace the stub `computeZipCodes` with the same call admin already uses:

- Build a closed GeoJSON ring from `coordinates` (`[lng, lat]` pairs, first point repeated at the end)
- Call `supabase.rpc('get_zcta_codes_for_polygon', { polygon_coords: ring })`
- Set `precomputedZipCodes` to the returned array
- Keep the existing toast for "few ZIPs found" and the optional `renderZipBoundaries` preview

This is a ~25-line replacement inside one function. No other worker code changes — `saveServiceArea` already forwards `precomputedZipCodes` to the edge function correctly.

### Change 2 — Stop rebuilding the admin map on every state change

In `src/components/admin/AdminServiceAreaMap.tsx`:

- Change the init `useEffect` dependency at line 851 from `[isActive, serviceAreas]` → `[isActive]`
- Add a `serviceAreasRef = useRef<ServiceArea[]>([])` and keep it in sync with a tiny `useEffect(() => { serviceAreasRef.current = serviceAreas }, [serviceAreas])`
- In the two spots inside the init effect that read `serviceAreas` (the `Draw.Event.CREATED` handler around line 571 — choosing default existing-vs-new selection), read from `serviceAreasRef.current` instead

The dropdown that lists existing areas in the JSX (lines 1191, 1218, 1223, 1289, 1297, 1305) keeps reading `serviceAreas` directly — those are render-time reads and re-render normally. Nothing else needs to move.

### Change 3 — Tiny cleanup (low risk, high signal)

While we're in `ServiceAreaMap.tsx`, remove the misleading log line `'🔍 Database will compute ZIP codes for polygon...'` since the client now actually does the RPC call. Replace with a single accurate log that mirrors admin's style. No other logging or behavior changes.

## What we deliberately don't do

- **No edge function changes.** `service-area-upsert` already trusts the precomputed array.
- **No database / RPC / RLS / migration changes.** Everything server-side already works.
- **No switch to client-side Turf.js.** The user's message suggests Turf as one option — we don't need it. PostGIS via the existing RPC is faster, already deployed, and avoids shipping the full ~50 MB ZCTA GeoJSON to every worker browser just to compute intersections.
- **No changes to `WorkerServiceAreasMap.tsx`, `ServiceCoverageMapWithBoundaries.tsx`, or any of the other map components.** They aren't part of the broken draw-and-capture flow.
- **No changes to the draw controls, leaflet-draw config, edit/delete handlers, or saved-area display.** Existing polygons keep rendering exactly as they do today.

## Files touched

1. `src/components/worker/service-area/ServiceAreaMap.tsx` — replace `computeZipCodes` body to call `get_zcta_codes_for_polygon` (matches admin)
2. `src/components/admin/AdminServiceAreaMap.tsx` — drop `serviceAreas` from the init `useEffect` deps, add `serviceAreasRef`, read from ref inside the `CREATED` handler

## How we'll verify after the change

- Worker: draw a polygon over a known multi-ZIP area → "Found ZIP codes" badge shows the actual count → Save → `worker_service_areas` row gets the right zipcodes
- Admin: start drawing, let realtime fire / save another area in another tab → in-progress polygon survives, draw control stays mounted
- Existing saved areas still render on map load (regression check on both)
- `service_area_audit_logs` shows successful upserts again instead of only deletes
