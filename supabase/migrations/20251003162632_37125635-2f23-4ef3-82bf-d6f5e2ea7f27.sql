-- Phase 1: Restore Critical TV Mounting Services
-- This migration fixes the TV Mounting service by:
-- 1. Renaming "Mount TV" back to "TV Mounting" for code compatibility
-- 2. Hiding TV mounting add-ons from the main service list

-- Rename "Mount TV" to "TV Mounting"
UPDATE services 
SET name = 'TV Mounting'
WHERE name = 'Mount TV';

-- Hide all TV mounting add-ons from main service list
-- These will still be available in the TV Mounting configuration modal
UPDATE services 
SET is_visible = false 
WHERE name IN (
  'Over 65" TV Add-on',
  'Frame Mount Add-on', 
  'Brick/Steel/Concrete',
  'Mount Soundbar'
);