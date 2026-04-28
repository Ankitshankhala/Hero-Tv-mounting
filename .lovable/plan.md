## Why polygon→ZIP sync is currently failing

I checked the database and code. The root cause is **not** a bug in the sync flow — it's missing reference data plus a sync UI that isn't wired into the admin coverage screen.

### Database evidence
Service areas with valid polygons but **0 stored ZIPs**:
- Ayden Alexander — "San antonio" (21 polygon points, 0 zips)
- Ayden Alexander — "San Antonio" (20 pts, 1 zip)
- Henry Griffith — "South Austin" (20 pts, 0 zips)
- Warren Kenneth Joe — "Fort Worth" (20 pts, 0 zips)
- Frisco area (21 pts, 0 zips)

Older areas (ANKIT/Houston, Chad/Dallas, michael/KC, Eric/N. Austin) have ZIPs because they were seeded earlier when reference data still existed.

### Root cause
The `service-area-upsert` edge function computes ZIPs in this order:
1. `get_zcta_codes_for_polygon` RPC against `us_zcta_polygons`
2. PostGIS intersect fallback against `us_zip_codes`
3. Bounding-box fallback against `us_zip_codes`

But the reference tables are nearly empty:
- `us_zcta_polygons`: **25 rows** (should be ~33,791)
- `us_zip_codes`: **25 rows total** (only TX, missing >40k US ZIPs)

So for any polygon outside those 25 rows, every method returns 0 ZIPs and nothing gets stored. That's exactly what we see for Henry, Ayden, Warren, etc.

A second issue: there is a working `<ServiceAreaZipSync>` component, but it's **not mounted** in `AdminServiceAreasUnified` or `AdminCoverageManager`, so admins have no per-area "Sync Now" button to re-run the computation after data is repopulated.

---

## Plan

### 1. Repopulate `us_zip_codes` (centroids) — primary fix
Create a new edge function `seed-us-zip-codes` that:
- Downloads the public OpenDataDE / SimpleMaps US ZIP centroid dataset (CSV, ~42k rows: zipcode, city, state, state_abbr, lat, lng).
- Upserts in batches of 1000 into `us_zip_codes`.
- Returns counts.
Admin triggers it once from a new "Reference Data" admin tool button. This alone makes the PostGIS-intersect and bbox fallbacks work for every US polygon.

### 2. Repopulate `us_zcta_polygons` (boundaries) — accuracy fix
Reuse/repair `import-zcta-data` (currently a stub) so it actually streams Census Bureau ZCTA GeoJSON in batches and inserts geometries with `ST_GeomFromGeoJSON`. Same admin button can run it. Once populated, the primary `get_zcta_codes_for_polygon` path produces the most accurate results.

### 3. Mount Sync UI in Admin Coverage
In `AdminServiceAreasUnified.tsx`, render `<ServiceAreaZipSync>` inside each worker's expanded area card (one per `worker_service_areas` row), passing `serviceArea` and `workerId`. Also add a top-level **"Sync All Areas"** button that loops every active area with a non-empty polygon and calls the same `service-area-upsert` flow with `mode: 'replace_all'`, showing per-area progress and a final summary toast.

### 4. Harden the edge function
Small fixes in `supabase/functions/service-area-upsert/index.ts`:
- When `mode === 'replace_all'` and the recompute returns 0 ZIPs, do **not** delete existing ZIPs (avoid wiping good data on a transient failure).
- Always return the resolved `zipcodes` and an explicit `method` field (`zcta` | `postgis` | `bbox` | `none`) so the UI can show how the result was obtained.
- Replace `.single()` calls on inserts with safer error handling and add log lines for the polygon centroid + bbox to help future debugging.

### 5. Verify
After data import + sync-all run, confirm via SQL that all listed workers' areas have a reasonable `zip_count` (≥ ~10 for city-sized polygons), then spot-check one ZIP per worker against `get_available_time_slots` to confirm bookings will route correctly.

---

## Files to change
- `supabase/functions/seed-us-zip-codes/index.ts` (new)
- `supabase/functions/import-zcta-data/index.ts` (replace stub with real importer)
- `supabase/functions/service-area-upsert/index.ts` (safer replace_all + method reporting)
- `src/components/admin/AdminServiceAreasUnified.tsx` (mount `ServiceAreaZipSync` + "Sync All Areas" button)
- `src/components/admin/AdminCoverageManager.tsx` (optional: surface zip_count = 0 warnings inline)

## Out of scope
- Changing `worker_service_zipcodes` schema or RLS.
- Changing how customer booking flow looks up workers (it already reads `worker_service_zipcodes` correctly).
