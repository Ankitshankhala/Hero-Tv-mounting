-- Enable PostGIS extension for spatial operations
CREATE EXTENSION IF NOT EXISTS postgis;

-- Create zip_polygons table with spatial geometry
CREATE TABLE IF NOT EXISTS public.zip_polygons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zipcode TEXT NOT NULL UNIQUE,
  state_code TEXT NOT NULL,
  state_name TEXT,
  city TEXT,
  geom GEOMETRY(MULTIPOLYGON, 4326) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create spatial index for efficient queries
CREATE INDEX IF NOT EXISTS idx_zip_polygons_geom ON public.zip_polygons USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_zip_polygons_zipcode ON public.zip_polygons (zipcode);
CREATE INDEX IF NOT EXISTS idx_zip_polygons_state ON public.zip_polygons (state_code);

-- Create RPC function to find ZIP codes intersecting with a polygon
CREATE OR REPLACE FUNCTION public.find_zipcodes_intersecting_polygon(
  polygon_geojson JSONB
)
RETURNS TABLE(zipcode TEXT, state_code TEXT, city TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_polygon GEOMETRY;
BEGIN
  -- Convert GeoJSON polygon to PostGIS geometry
  -- Handle both Polygon and MultiPolygon types from the frontend
  BEGIN
    user_polygon := ST_GeomFromGeoJSON(polygon_geojson::text);
    
    -- Ensure the geometry is in EPSG:4326 (WGS84)
    IF ST_SRID(user_polygon) = 0 THEN
      user_polygon := ST_SetSRID(user_polygon, 4326);
    ELSIF ST_SRID(user_polygon) != 4326 THEN
      user_polygon := ST_Transform(user_polygon, 4326);
    END IF;
    
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Invalid polygon GeoJSON: %', SQLERRM;
  END;
  
  -- Find all ZIP codes that intersect with the user polygon
  RETURN QUERY
  SELECT 
    zp.zipcode,
    zp.state_code,
    zp.city
  FROM public.zip_polygons zp
  WHERE ST_Intersects(zp.geom, user_polygon)
  ORDER BY zp.zipcode;
END;
$$;

-- Insert some sample ZIP code polygons for testing
-- This is just sample data - in production you'd load actual ZCTA data
INSERT INTO public.zip_polygons (zipcode, state_code, state_name, city, geom) VALUES
(
  '78701',
  'TX',
  'Texas',
  'Austin',
  ST_GeomFromText('MULTIPOLYGON(((-97.7431 30.2672, -97.7411 30.2672, -97.7411 30.2692, -97.7431 30.2692, -97.7431 30.2672)))', 4326)
),
(
  '78702',
  'TX', 
  'Texas',
  'Austin',
  ST_GeomFromText('MULTIPOLYGON(((-97.7411 30.2672, -97.7391 30.2672, -97.7391 30.2692, -97.7411 30.2692, -97.7411 30.2672)))', 4326)
),
(
  '78703',
  'TX',
  'Texas', 
  'Austin',
  ST_GeomFromText('MULTIPOLYGON(((-97.7391 30.2672, -97.7371 30.2672, -97.7371 30.2692, -97.7391 30.2692, -97.7391 30.2672)))', 4326)
),
(
  '78704',
  'TX',
  'Texas',
  'Austin', 
  ST_GeomFromText('MULTIPOLYGON(((-97.7431 30.2652, -97.7411 30.2652, -97.7411 30.2672, -97.7431 30.2672, -97.7431 30.2652)))', 4326)
),
(
  '78705',
  'TX',
  'Texas',
  'Austin',
  ST_GeomFromText('MULTIPOLYGON(((-97.7411 30.2652, -97.7391 30.2652, -97.7391 30.2672, -97.7411 30.2672, -97.7411 30.2652)))', 4326)
);

-- Enable RLS on the zip_polygons table
ALTER TABLE public.zip_polygons ENABLE ROW LEVEL SECURITY;

-- Create RLS policy to allow public read access to ZIP polygon data
CREATE POLICY "Anyone can view ZIP polygon data"
ON public.zip_polygons
FOR SELECT
USING (true);

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated, anon;
GRANT SELECT ON public.zip_polygons TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.find_zipcodes_intersecting_polygon(JSONB) TO authenticated, anon;