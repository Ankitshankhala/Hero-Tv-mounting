-- Create ZCTA ZIP Code Lookup Table for enhanced performance
CREATE TABLE public.zcta_zipcodes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  zcta_code TEXT NOT NULL UNIQUE,
  polygon_geometry GEOMETRY(MULTIPOLYGON, 4326) NOT NULL,
  bbox GEOMETRY(POLYGON, 4326) NOT NULL,
  land_area NUMERIC,
  water_area NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create spatial indexes for fast geometric operations
CREATE INDEX idx_zcta_zipcodes_polygon_geom ON public.zcta_zipcodes USING GIST (polygon_geometry);
CREATE INDEX idx_zcta_zipcodes_bbox ON public.zcta_zipcodes USING GIST (bbox);
CREATE INDEX idx_zcta_zipcodes_zcta_code ON public.zcta_zipcodes (zcta_code);

-- Enable RLS
ALTER TABLE public.zcta_zipcodes ENABLE ROW LEVEL SECURITY;

-- Create policies for ZCTA data access
CREATE POLICY "Anyone can view ZCTA ZIP codes" 
ON public.zcta_zipcodes 
FOR SELECT 
USING (true);

-- Function to populate ZCTA zipcodes from existing polygon data
CREATE OR REPLACE FUNCTION public.populate_zcta_zipcodes()
RETURNS INTEGER AS $$
DECLARE
  polygon_record RECORD;
  inserted_count INTEGER := 0;
BEGIN
  -- Clear existing data
  DELETE FROM public.zcta_zipcodes;
  
  -- Insert data from us_zcta_polygons
  FOR polygon_record IN 
    SELECT 
      zcta5ce,
      geom,
      land_area,
      water_area
    FROM public.us_zcta_polygons
    WHERE zcta5ce IS NOT NULL AND geom IS NOT NULL
  LOOP
    INSERT INTO public.zcta_zipcodes (
      zcta_code,
      polygon_geometry,
      bbox,
      land_area,
      water_area
    ) VALUES (
      polygon_record.zcta5ce,
      polygon_record.geom,
      ST_Envelope(polygon_record.geom),
      polygon_record.land_area,
      polygon_record.water_area
    );
    
    inserted_count := inserted_count + 1;
  END LOOP;
  
  RETURN inserted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function to find ZCTA codes within a polygon using spatial intersection
CREATE OR REPLACE FUNCTION public.get_zcta_codes_for_polygon(polygon_coords JSONB)
RETURNS TEXT[] AS $$
DECLARE
  polygon_geom GEOMETRY;
  zcta_codes TEXT[];
BEGIN
  -- Convert polygon coordinates to PostGIS geometry
  -- Assuming polygon_coords is in format: [[lng, lat], [lng, lat], ...]
  SELECT ST_GeomFromGeoJSON(
    jsonb_build_object(
      'type', 'Polygon',
      'coordinates', jsonb_build_array(polygon_coords)
    )
  ) INTO polygon_geom;
  
  -- Find intersecting ZCTA codes
  SELECT ARRAY_AGG(DISTINCT zcta_code ORDER BY zcta_code)
  INTO zcta_codes
  FROM public.zcta_zipcodes
  WHERE ST_Intersects(polygon_geometry, polygon_geom);
  
  RETURN COALESCE(zcta_codes, ARRAY[]::TEXT[]);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;