-- First, let's ensure we have the necessary database functions for loading sample ZCTA data
-- This will populate us_zcta_polygons with sample data for testing polygon functionality

-- Load sample ZCTA polygons directly into us_zcta_polygons
INSERT INTO us_zcta_polygons (zcta5ce, geom, land_area, water_area) VALUES
('75001', ST_GeomFromGeoJSON('{"type": "Polygon", "coordinates": [[[-96.7, 32.9], [-96.6, 32.9], [-96.6, 33.0], [-96.7, 33.0], [-96.7, 32.9]]]}'), 25000000, 500000),
('75002', ST_GeomFromGeoJSON('{"type": "Polygon", "coordinates": [[[-96.6, 32.9], [-96.5, 32.9], [-96.5, 33.0], [-96.6, 33.0], [-96.6, 32.9]]]}'), 26000000, 400000),
('75003', ST_GeomFromGeoJSON('{"type": "Polygon", "coordinates": [[[-96.5, 32.9], [-96.4, 32.9], [-96.4, 33.0], [-96.5, 33.0], [-96.5, 32.9]]]}'), 24000000, 600000),
('75201', ST_GeomFromGeoJSON('{"type": "Polygon", "coordinates": [[[-96.8, 32.8], [-96.7, 32.8], [-96.7, 32.9], [-96.8, 32.9], [-96.8, 32.8]]]}'), 20000000, 800000),
('75202', ST_GeomFromGeoJSON('{"type": "Polygon", "coordinates": [[[-96.7, 32.8], [-96.6, 32.8], [-96.6, 32.9], [-96.7, 32.9], [-96.7, 32.8]]]}'), 22000000, 700000);

-- Load more ZIP codes into us_zip_codes to support the ZCTA areas
INSERT INTO us_zip_codes (zipcode, city, state, state_abbr, latitude, longitude) VALUES
('75001', 'Addison', 'Texas', 'TX', 32.9616, -96.7094),
('75002', 'Addison', 'Texas', 'TX', 32.9584, -96.6778),
('75003', 'Allen', 'Texas', 'TX', 33.1031, -96.6706),
('75201', 'Dallas', 'Texas', 'TX', 32.7767, -96.7970),
('75202', 'Dallas', 'Texas', 'TX', 32.7831, -96.7836),
('75203', 'Dallas', 'Texas', 'TX', 32.7668, -96.7836),
('75204', 'Dallas', 'Texas', 'TX', 32.7912, -96.7586),
('75205', 'Dallas', 'Texas', 'TX', 32.8068, -96.7836),
('75206', 'Dallas', 'Texas', 'TX', 32.8218, -96.7467),
('75207', 'Dallas', 'Texas', 'TX', 32.8040, -96.8339),
('75208', 'Dallas', 'Texas', 'TX', 32.7668, -96.8161),
('75209', 'Dallas', 'Texas', 'TX', 32.8429, -96.8017),
('75210', 'Dallas', 'Texas', 'TX', 32.7450, -96.6878),
('75211', 'Dallas', 'Texas', 'TX', 32.7318, -96.8183),
('75212', 'Dallas', 'Texas', 'TX', 32.7834, -96.8631),
('75214', 'Dallas', 'Texas', 'TX', 32.8018, -96.7147),
('75215', 'Dallas', 'Texas', 'TX', 32.7542, -96.7239),
('75216', 'Dallas', 'Texas', 'TX', 32.7179, -96.7508),
('75217', 'Dallas', 'Texas', 'TX', 32.7218, -96.6928),
('75218', 'Dallas', 'Texas', 'TX', 32.8457, -96.7281),
('75219', 'Dallas', 'Texas', 'TX', 32.7937, -96.8056),
('75220', 'Dallas', 'Texas', 'TX', 32.8538, -96.8519)
ON CONFLICT (zipcode) DO UPDATE SET
city = EXCLUDED.city,
state = EXCLUDED.state,
state_abbr = EXCLUDED.state_abbr,
latitude = EXCLUDED.latitude,
longitude = EXCLUDED.longitude;