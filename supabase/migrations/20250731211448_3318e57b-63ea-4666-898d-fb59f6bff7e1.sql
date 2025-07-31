-- Ensure TV mounting add-on services are active so they can be added to cart
-- They should be active but not visible in main services list

UPDATE services 
SET is_active = true, is_visible = false 
WHERE name IN (
  'Over 65" TV Add-on',
  'Frame Mount Add-on', 
  'Stone/Brick/Tile Wall',
  'Mount Soundbar'
);