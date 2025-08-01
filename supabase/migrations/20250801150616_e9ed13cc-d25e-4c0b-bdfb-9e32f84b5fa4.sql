-- Add missing TV mounting add-on services that are required by the TV mounting modal
-- Only insert if they don't already exist

INSERT INTO public.services (name, description, base_price, duration_minutes, is_active, is_visible, sort_order) 
SELECT * FROM (VALUES 
  ('Over 65" TV Add-on', 'Additional service for mounting TVs larger than 65 inches', 25.00, 15, true, false, 1001),
  ('Frame Mount Add-on', 'Additional service for frame TV mounting', 25.00, 15, true, false, 1002),
  ('Stone/Brick/Tile Wall', 'Additional service for mounting on stone, brick, or tile walls', 50.00, 30, true, false, 1003)
) AS v(name, description, base_price, duration_minutes, is_active, is_visible, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM public.services WHERE services.name = v.name
);