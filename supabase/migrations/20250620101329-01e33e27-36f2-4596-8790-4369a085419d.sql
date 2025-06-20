
-- Add is_visible column to services table
ALTER TABLE public.services 
ADD COLUMN is_visible boolean NOT NULL DEFAULT true;

-- Update the column comment for clarity
COMMENT ON COLUMN public.services.is_visible IS 'Whether the service is visible on the frontend';
