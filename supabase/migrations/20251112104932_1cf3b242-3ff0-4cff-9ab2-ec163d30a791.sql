-- Add pricing_config column to services table for complex pricing structures
ALTER TABLE services 
ADD COLUMN pricing_config JSONB DEFAULT NULL;

-- Update Mount TV with tiered pricing configuration
UPDATE services 
SET pricing_config = jsonb_build_object(
  'pricing_type', 'tiered',
  'tiers', jsonb_build_array(
    jsonb_build_object('quantity', 1, 'price', 90),
    jsonb_build_object('quantity', 2, 'price', 80),
    jsonb_build_object('quantity', 3, 'price', 70, 'is_default_for_additional', true)
  ),
  'add_ons', jsonb_build_object(
    'over65', 50,
    'frameMount', 75,
    'specialWall', 40,
    'soundbar', 30
  )
)
WHERE name = 'Mount TV';

-- Create index for better performance when querying pricing_config
CREATE INDEX idx_services_pricing_config ON services USING GIN (pricing_config);