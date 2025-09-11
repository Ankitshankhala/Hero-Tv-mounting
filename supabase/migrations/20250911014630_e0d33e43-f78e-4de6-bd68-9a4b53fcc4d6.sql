-- Clean up orphaned data first
DELETE FROM worker_service_zipcodes 
WHERE service_area_id NOT IN (SELECT id FROM worker_service_areas);

-- Now apply the schema changes
-- Ensure PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- Add spatial geometry column to worker_service_areas for polygon storage
ALTER TABLE public.worker_service_areas
  ADD COLUMN IF NOT EXISTS geom geometry(MultiPolygon, 4326);

-- Create spatial index for worker_service_areas
CREATE INDEX IF NOT EXISTS idx_worker_service_areas_geom
  ON public.worker_service_areas USING GIST (geom);

-- Make service_area_id nullable in worker_service_zipcodes (for manual entries)
ALTER TABLE public.worker_service_zipcodes
  ALTER COLUMN service_area_id DROP NOT NULL;

-- Add dual-source flags to worker_service_zipcodes
ALTER TABLE public.worker_service_zipcodes
  ADD COLUMN IF NOT EXISTS from_manual boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS from_polygon boolean NOT NULL DEFAULT false;

-- Add unique constraint to prevent duplicate (worker_id, zipcode) rows
ALTER TABLE public.worker_service_zipcodes
  ADD CONSTRAINT uq_wsz_worker_zip UNIQUE (worker_id, zipcode);

-- Add proper foreign key constraints
ALTER TABLE public.worker_service_zipcodes
  ADD CONSTRAINT fk_wsz_worker
    FOREIGN KEY (worker_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.worker_service_zipcodes
  ADD CONSTRAINT fk_wsz_service_area
    FOREIGN KEY (service_area_id) REFERENCES public.worker_service_areas(id) ON DELETE SET NULL;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_wsz_zipcode ON public.worker_service_zipcodes(zipcode);
CREATE INDEX IF NOT EXISTS idx_wsz_worker ON public.worker_service_zipcodes(worker_id);

-- Create materialized coverage overlay table for fast map display
CREATE TABLE IF NOT EXISTS public.worker_coverage_overlays (
  worker_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  overlay_geom geometry(MultiPolygon, 4326),
  zip_count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_worker_coverage_overlays_geom
  ON public.worker_coverage_overlays USING GIST (overlay_geom);