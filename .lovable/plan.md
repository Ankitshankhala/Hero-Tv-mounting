## Goal

Make Henry, Ayden, Warren, Chad, Michael, and Eric's drawn polygons resolve to ZIP codes correctly. Currently only ANKIT works (1163 ZIPs) because two of the three resolution methods are broken at the data layer.

## Root Cause Recap

| Problem | Evidence |
|---|---|
| `worker_service_areas.geom` is NULL for all 17 polygons | PostGIS `ST_Within` fallback returns 0 |
| `us_zip_codes` table has only 25 of ~42k rows | bbox/centroid fallback returns 0 |
| Only ZCTA intersection works, and it misses smaller polygons | Henry/Warren/etc. get 0–few ZIPs |

## Step 1 — Database Migration (this approval)

Two safe additions, no destructive changes:

**A. Helper function `polygon_coords_to_geom(jsonb)`**
Converts the existing `polygon_coordinates` jsonb (array of `{lat,lng}` points) into a PostGIS polygon (SRID 4326). Handles three input shapes (`{lat,lng}`, `{latitude,longitude}`, `[lng,lat]`). Returns NULL on bad input rather than failing.

**B. Trigger `trg_sync_service_area_geom`**
Fires `BEFORE INSERT OR UPDATE OF polygon_coordinates`. Auto-fills `geom` from `polygon_coordinates`. Workers and admin keep saving polygons exactly the same way — `geom` is maintained silently.

**C. Backfill**
One-shot UPDATE that fills `geom` for the 17 existing polygons.

**D. Spatial index**
`CREATE INDEX ... USING GIST (geom)` so PostGIS lookups stay fast as ZIP/polygon counts grow.

## Safety

- `polygon_coordinates` is read-only in this migration — never modified
- `worker_service_zipcodes` is untouched — no ZIP loss
- Bad polygons return NULL, never raise — backfill cannot fail mid-way
- Trigger uses `BEFORE` so it can't deadlock with reads
- Fully reversible: `DROP TRIGGER` + `DROP FUNCTION` + `geom` column already nullable

## Step 2 (after migration) — Verify

I'll run a query showing `geom IS NOT NULL` count per worker. Expect 17/17 backfilled.

## Step 3 (after migration) — Seed `us_zip_codes`

You click **"Seed ZIP Centroids"** on the admin dashboard. This is the existing button that calls the `seed-us-zip-codes` edge function and populates ~42k centroids.

## Step 4 (after migration) — Run "Sync All Areas"

Click the existing button. Now all three resolution paths (zcta + postgis + bbox) are alive, so every worker's polygon resolves to its ZIPs.

## Step 5 — Verify and report

Compare before/after ZIP counts per worker. Expected outcome:

| Worker | Before | After (estimated) |
|---|---|---|
| ANKIT | 1163 | ~1163 (±small) |
| Henry | 39 | hundreds |
| Ayden | 1 | hundreds |
| Warren | 83 | hundreds |
| Chad | 94 | hundreds |
| Michael | 136 | hundreds |
| Eric | 13 | tens-hundreds |

If any worker regresses below their current count, the upsert function's existing 0-result guard prevents the wipe and we investigate before retrying.

## What does NOT change

- Worker polygon-drawing UI — identical
- Admin service-areas UI — identical (already has Sync button wired)
- Booking flow / coverage check API — identical
- Any edge function contracts — identical
- Existing ZIP assignments — preserved

## Files / objects touched

- New SQL function: `public.polygon_coords_to_geom(jsonb)`
- New SQL function: `public.sync_service_area_geom()`
- New trigger: `trg_sync_service_area_geom` on `worker_service_areas`
- New index: `idx_worker_service_areas_geom`
- One UPDATE statement (backfill, ~17 rows)

No code files changed in step 1. Steps 3 and 4 are button clicks you perform.