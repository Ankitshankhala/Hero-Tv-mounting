-- Enhanced ZIP code data structure for comprehensive US coverage
CREATE TABLE IF NOT EXISTS public.comprehensive_zip_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zipcode TEXT NOT NULL UNIQUE,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  state_abbr TEXT NOT NULL,
  county TEXT,
  latitude NUMERIC(10, 7),
  longitude NUMERIC(10, 7),
  land_area NUMERIC,
  water_area NUMERIC,
  population INTEGER,
  timezone TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  data_source TEXT DEFAULT 'census'
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_comprehensive_zip_codes_zipcode ON public.comprehensive_zip_codes(zipcode);
CREATE INDEX IF NOT EXISTS idx_comprehensive_zip_codes_state ON public.comprehensive_zip_codes(state_abbr);
CREATE INDEX IF NOT EXISTS idx_comprehensive_zip_codes_location ON public.comprehensive_zip_codes(latitude, longitude);

-- Enhanced ZCTA polygons table
CREATE TABLE IF NOT EXISTS public.comprehensive_zcta_polygons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zcta5ce TEXT NOT NULL UNIQUE,
  geom GEOMETRY(MULTIPOLYGON, 4326) NOT NULL,
  land_area NUMERIC,
  water_area NUMERIC,
  internal_lat NUMERIC(10, 7),
  internal_lng NUMERIC(10, 7),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  data_source TEXT DEFAULT 'census'
);

-- Create spatial index
CREATE INDEX IF NOT EXISTS idx_comprehensive_zcta_geom ON public.comprehensive_zcta_polygons USING GIST(geom);

-- Function to migrate existing data
CREATE OR REPLACE FUNCTION migrate_existing_zip_data()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  migrated_count INTEGER := 0;
BEGIN
  -- Migrate from us_zip_codes to comprehensive table
  INSERT INTO public.comprehensive_zip_codes (
    zipcode, city, state, state_abbr, latitude, longitude, data_source
  )
  SELECT 
    zipcode, city, state, state_abbr, latitude, longitude, 'legacy'
  FROM public.us_zip_codes
  ON CONFLICT (zipcode) DO NOTHING;
  
  GET DIAGNOSTICS migrated_count = ROW_COUNT;
  
  -- Migrate from us_zcta_polygons to comprehensive table
  INSERT INTO public.comprehensive_zcta_polygons (
    zcta5ce, geom, land_area, water_area, data_source
  )
  SELECT 
    zcta5ce, geom, land_area, water_area, 'legacy'
  FROM public.us_zcta_polygons
  ON CONFLICT (zcta5ce) DO NOTHING;
  
  RETURN migrated_count;
END;
$$;

-- Function to get comprehensive ZIP boundary data
CREATE OR REPLACE FUNCTION get_comprehensive_zip_boundaries(
  p_lat NUMERIC,
  p_lng NUMERIC,
  p_radius_km NUMERIC DEFAULT 50
)
RETURNS TABLE(
  zipcode TEXT,
  boundary_geojson JSONB,
  distance_km NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    czp.zcta5ce,
    ST_AsGeoJSON(czp.geom)::JSONB,
    ST_Distance(
      ST_GeogFromText('POINT(' || p_lng || ' ' || p_lat || ')'),
      ST_Centroid(czp.geom)::GEOGRAPHY
    ) / 1000 as distance_km
  FROM public.comprehensive_zcta_polygons czp
  WHERE ST_DWithin(
    ST_GeogFromText('POINT(' || p_lng || ' ' || p_lat || ')'),
    ST_Centroid(czp.geom)::GEOGRAPHY,
    p_radius_km * 1000
  )
  ORDER BY distance_km
  LIMIT 100;
END;
$$;

-- Function to check ZIP coverage with comprehensive data
CREATE OR REPLACE FUNCTION comprehensive_zip_has_coverage(p_zipcode TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM public.comprehensive_zip_codes czc
    INNER JOIN worker_service_zipcodes wsz ON wsz.zipcode = czc.zipcode
    INNER JOIN worker_service_areas wsa ON wsz.service_area_id = wsa.id
    INNER JOIN users u ON wsa.worker_id = u.id
    WHERE czc.zipcode = p_zipcode 
    AND wsa.is_active = true
    AND u.is_active = true
    AND u.role = 'worker'
  );
END;
$$;

-- Enable RLS
ALTER TABLE public.comprehensive_zip_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comprehensive_zcta_polygons ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can view comprehensive ZIP codes" ON public.comprehensive_zip_codes FOR SELECT USING (true);
CREATE POLICY "Anyone can view comprehensive ZCTA polygons" ON public.comprehensive_zcta_polygons FOR SELECT USING (true);
CREATE POLICY "Admins can manage comprehensive ZIP codes" ON public.comprehensive_zip_codes FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Admins can manage comprehensive ZCTA polygons" ON public.comprehensive_zcta_polygons FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
);

-- Migrate existing data
SELECT migrate_existing_zip_data();