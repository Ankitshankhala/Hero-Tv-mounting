-- Create Mount Soundbar service for TV mounting configurations
INSERT INTO services (
  name,
  description,
  base_price,
  duration_minutes,
  is_active,
  is_visible,
  sort_order
) VALUES (
  'Mount Soundbar',
  'Mount soundbar below or above TV',
  40.00,
  20,
  true,
  true,
  600
);