-- Fix booking services with 0 base_price by getting the correct price from services table
UPDATE booking_services 
SET base_price = services.base_price
FROM services
WHERE booking_services.service_id = services.id 
AND booking_services.base_price = 0;