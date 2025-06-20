
-- Add sort_order column to services table
ALTER TABLE services ADD COLUMN sort_order INTEGER;

-- Set initial sort_order values using a different approach
WITH ordered_services AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY name ASC) as new_order
  FROM services
)
UPDATE services 
SET sort_order = ordered_services.new_order
FROM ordered_services
WHERE services.id = ordered_services.id;

-- Make sort_order not null with a default value for new services
ALTER TABLE services ALTER COLUMN sort_order SET NOT NULL;
ALTER TABLE services ALTER COLUMN sort_order SET DEFAULT 1000;
