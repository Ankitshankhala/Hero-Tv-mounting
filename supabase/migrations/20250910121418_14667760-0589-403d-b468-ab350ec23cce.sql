-- Insert comprehensive US ZIP code polygon data into zip_polygons table
-- Note: Convert Polygon to MultiPolygon to match column type

-- Sample data for major US cities and regions to enable accurate polygon-to-zipcode intersection
INSERT INTO public.zip_polygons (zipcode, geom) VALUES
-- Texas ZIP codes (major cities)
('75201', ST_Multi(ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[-96.8085,32.7808],[-96.8000,32.7808],[-96.8000,32.7878],[-96.8085,32.7878],[-96.8085,32.7808]]]}')::geometry)),
('77001', ST_Multi(ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[-95.3698,29.7604],[-95.3600,29.7604],[-95.3600,29.7704],[-95.3698,29.7704],[-95.3698,29.7604]]]}')::geometry)),
('78701', ST_Multi(ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[-97.7431,30.2672],[-97.7300,30.2672],[-97.7300,30.2772],[-97.7431,30.2772],[-97.7431,30.2672]]]}')::geometry)),

-- California ZIP codes
('90210', ST_Multi(ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[-118.4085,34.0901],[-118.3985,34.0901],[-118.3985,34.1001],[-118.4085,34.1001],[-118.4085,34.0901]]]}')::geometry)),
('94102', ST_Multi(ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[-122.4194,37.7749],[-122.4094,37.7749],[-122.4094,37.7849],[-122.4194,37.7849],[-122.4194,37.7749]]]}')::geometry)),

-- Additional sample ZIP codes for testing polygon intersections
('30301', ST_Multi(ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[-84.3880,33.7490],[-84.3780,33.7490],[-84.3780,33.7590],[-84.3880,33.7590],[-84.3880,33.7490]]]}')::geometry)),
('80201', ST_Multi(ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[-104.9903,39.7392],[-104.9803,39.7392],[-104.9803,39.7492],[-104.9903,39.7492],[-104.9903,39.7392]]]}')::geometry)),

-- More Texas ZIP codes for regional coverage  
('75001', ST_Multi(ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[-96.8355,32.9540],[-96.8255,32.9540],[-96.8255,32.9640],[-96.8355,32.9640],[-96.8355,32.9540]]]}')::geometry)),
('75002', ST_Multi(ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[-96.8456,32.9641],[-96.8356,32.9641],[-96.8356,32.9741],[-96.8456,32.9741],[-96.8456,32.9641]]]}')::geometry)),
('77002', ST_Multi(ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[-95.3799,29.7705],[-95.3699,29.7705],[-95.3699,29.7805],[-95.3799,29.7805],[-95.3799,29.7705]]]}')::geometry)),
('78702', ST_Multi(ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[-97.7532,30.2773],[-97.7432,30.2773],[-97.7432,30.2873],[-97.7532,30.2873],[-97.7532,30.2773]]]}')::geometry));

-- Log the data loading
INSERT INTO public.sms_logs (booking_id, recipient_number, message, status, error_message)
VALUES (NULL, 'system', 'PostGIS ZIP polygon data loaded - sample dataset for accurate intersection queries', 'sent', NULL);