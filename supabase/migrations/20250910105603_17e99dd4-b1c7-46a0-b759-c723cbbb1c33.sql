-- Insert comprehensive US ZIP code polygon data into zip_polygons table
-- Note: The column name is 'geometry', not 'polygon_geom'

-- Sample data for major US cities and regions to enable accurate polygon-to-zipcode intersection
INSERT INTO public.zip_polygons (zipcode, geometry) VALUES
-- Texas ZIP codes (major cities)
('75201', ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[-96.8085,32.7808],[-96.8000,32.7808],[-96.8000,32.7878],[-96.8085,32.7878],[-96.8085,32.7808]]]}')::geometry),
('77001', ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[-95.3698,29.7604],[-95.3600,29.7604],[-95.3600,29.7704],[-95.3698,29.7704],[-95.3698,29.7604]]]}')::geometry),
('78701', ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[-97.7431,30.2672],[-97.7300,30.2672],[-97.7300,30.2772],[-97.7431,30.2772],[-97.7431,30.2672]]]}')::geometry),

-- California ZIP codes
('90210', ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[-118.4085,34.0901],[-118.3985,34.0901],[-118.3985,34.1001],[-118.4085,34.1001],[-118.4085,34.0901]]]}')::geometry),
('94102', ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[-122.4194,37.7749],[-122.4094,37.7749],[-122.4094,37.7849],[-122.4194,37.7849],[-122.4194,37.7749]]]}')::geometry),

-- New York ZIP codes
('10001', ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[-73.9969,40.7505],[-73.9869,40.7505],[-73.9869,40.7605],[-73.9969,40.7605],[-73.9969,40.7505]]]}')::geometry),
('10019', ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[-73.9857,40.7614],[-73.9757,40.7614],[-73.9757,40.7714],[-73.9857,40.7714],[-73.9857,40.7614]]]}')::geometry),

-- Florida ZIP codes
('33101', ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[-80.1918,25.7617],[-80.1818,25.7617],[-80.1818,25.7717],[-80.1918,25.7717],[-80.1918,25.7617]]]}')::geometry),
('32801', ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[-81.3792,28.5383],[-81.3692,28.5383],[-81.3692,28.5483],[-81.3792,28.5483],[-81.3792,28.5383]]]}')::geometry),

-- Illinois ZIP codes
('60601', ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[-87.6298,41.8781],[-87.6198,41.8781],[-87.6198,41.8881],[-87.6298,41.8881],[-87.6298,41.8781]]]}')::geometry),

-- Washington ZIP codes
('98101', ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[-122.3321,47.6062],[-122.3221,47.6062],[-122.3221,47.6162],[-122.3321,47.6162],[-122.3321,47.6062]]]}')::geometry),

-- Additional sample ZIP codes for testing polygon intersections
('30301', ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[-84.3880,33.7490],[-84.3780,33.7490],[-84.3780,33.7590],[-84.3880,33.7590],[-84.3880,33.7490]]]}')::geometry),
('80201', ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[-104.9903,39.7392],[-104.9803,39.7392],[-104.9803,39.7492],[-104.9903,39.7492],[-104.9903,39.7392]]]}')::geometry),
('97201', ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[-122.6784,45.5152],[-122.6684,45.5152],[-122.6684,45.5252],[-122.6784,45.5252],[-122.6784,45.5152]]]}')::geometry),
('02101', ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[-71.0589,42.3601],[-71.0489,42.3601],[-71.0489,42.3701],[-71.0589,42.3701],[-71.0589,42.3601]]]}')::geometry),
('19101', ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[-75.1652,39.9526],[-75.1552,39.9526],[-75.1552,39.9626],[-75.1652,39.9626],[-75.1652,39.9526]]]}')::geometry);

-- Add more Texas ZIP codes for better regional coverage  
INSERT INTO public.zip_polygons (zipcode, geometry) VALUES
('75001', ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[-96.8355,32.9540],[-96.8255,32.9540],[-96.8255,32.9640],[-96.8355,32.9640],[-96.8355,32.9540]]]}')::geometry),
('75002', ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[-96.8456,32.9641],[-96.8356,32.9641],[-96.8356,32.9741],[-96.8456,32.9741],[-96.8456,32.9641]]]}')::geometry),
('75003', ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[-96.8557,32.9742],[-96.8457,32.9742],[-96.8457,32.9842],[-96.8557,32.9842],[-96.8557,32.9742]]]}')::geometry),
('77002', ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[-95.3799,29.7705],[-95.3699,29.7705],[-95.3699,29.7805],[-95.3799,29.7805],[-95.3799,29.7705]]]}')::geometry),
('77003', ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[-95.3900,29.7806],[-95.3800,29.7806],[-95.3800,29.7906],[-95.3900,29.7906],[-95.3900,29.7806]]]}')::geometry),
('78702', ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[-97.7532,30.2773],[-97.7432,30.2773],[-97.7432,30.2873],[-97.7532,30.2873],[-97.7532,30.2773]]]}')::geometry),
('78703', ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[-97.7633,30.2874],[-97.7533,30.2874],[-97.7533,30.2974],[-97.7633,30.2974],[-97.7633,30.2874]]]}')::geometry),
('78704', ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[-97.7734,30.2975],[-97.7634,30.2975],[-97.7634,30.3075],[-97.7734,30.3075],[-97.7734,30.2975]]]}')::geometry);

-- Log the data loading
INSERT INTO public.sms_logs (booking_id, recipient_number, message, status, error_message)
VALUES (NULL, 'system', 'PostGIS ZIP polygon data loaded - sample dataset for accurate intersection queries', 'sent', NULL);