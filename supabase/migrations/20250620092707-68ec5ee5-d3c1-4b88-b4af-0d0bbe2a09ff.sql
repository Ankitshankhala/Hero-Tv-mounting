
-- Add image_url column to services table
ALTER TABLE services ADD COLUMN IF NOT EXISTS image_url TEXT;
