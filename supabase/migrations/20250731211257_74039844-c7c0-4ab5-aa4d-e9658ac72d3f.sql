-- Hide TV mounting add-on services from public view
-- These should only be available as add-ons within TV mounting configuration

UPDATE services 
SET is_visible = false 
WHERE name IN (
  'Over 65" TV Add-on',
  'Frame Mount Add-on', 
  'Stone/Brick/Tile Wall',
  'Mount Soundbar'
);