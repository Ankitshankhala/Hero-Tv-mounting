-- Make TV mounting add-on services visible so they can be used in configurations
UPDATE services 
SET is_visible = true 
WHERE name IN ('Over 65" TV Add-on', 'Frame Mount Add-on', 'Stone/Brick/Tile Wall');