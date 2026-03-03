UPDATE services 
SET pricing_config = '{
  "pricing_type": "tiered",
  "tiers": [
    {"quantity": 1, "price": 90},
    {"quantity": 2, "price": 80},
    {"quantity": 3, "price": 70, "is_default_for_additional": true}
  ],
  "add_ons": {
    "over65": 25,
    "frameMount": 40,
    "soundbar": 40,
    "specialWall": 40
  }
}'::jsonb
WHERE id = 'a50013bc-ee03-4452-b3ec-1683094d787a' AND name = 'Mount TV';