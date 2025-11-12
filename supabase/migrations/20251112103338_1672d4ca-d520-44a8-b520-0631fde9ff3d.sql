-- Update Mount TV base price from $100 to $90
UPDATE services 
SET base_price = 90.00 
WHERE name = 'Mount TV';