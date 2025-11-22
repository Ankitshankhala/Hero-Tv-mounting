-- Phase 1: Update Mount TV pricing_config to match correct add-on prices
UPDATE services 
SET pricing_config = jsonb_set(
  jsonb_set(
    jsonb_set(
      jsonb_set(
        COALESCE(pricing_config, '{}'::jsonb),
        '{add_ons}',
        COALESCE(pricing_config->'add_ons', '{}'::jsonb)
      ),
      '{add_ons,over65}',
      '25'::jsonb
    ),
    '{add_ons,frameMount}',
    '40'::jsonb
  ),
  '{add_ons,soundbar}',
  '40'::jsonb
)
WHERE name = 'Mount TV';

-- Ensure specialWall is also set correctly
UPDATE services 
SET pricing_config = jsonb_set(
  pricing_config,
  '{add_ons,specialWall}',
  '40'::jsonb
)
WHERE name = 'Mount TV' AND pricing_config IS NOT NULL;

-- Phase 4: Database constraint function to validate pricing consistency
CREATE OR REPLACE FUNCTION validate_pricing_consistency()
RETURNS TRIGGER AS $$
DECLARE
  config_price NUMERIC;
  service_price NUMERIC;
  add_on_name TEXT;
  mismatch_count INTEGER := 0;
BEGIN
  -- Only validate for Mount TV service with pricing_config
  IF NEW.name = 'Mount TV' AND NEW.pricing_config IS NOT NULL THEN
    
    -- Check over65 add-on
    config_price := (NEW.pricing_config->'add_ons'->>'over65')::NUMERIC;
    SELECT base_price INTO service_price 
    FROM services 
    WHERE name = 'Over 65" TV Add-on' AND is_active = true
    LIMIT 1;
    
    IF config_price IS NOT NULL AND service_price IS NOT NULL 
       AND config_price != service_price THEN
      mismatch_count := mismatch_count + 1;
      
      RAISE WARNING 'PRICING MISMATCH: Over 65" TV Add-on - config=$%, service=$%', 
        config_price, service_price;
      
      INSERT INTO admin_alerts (alert_type, message, severity, details)
      VALUES (
        'pricing_mismatch',
        'Mount TV pricing_config.add_ons.over65 does not match "Over 65" TV Add-on" base_price',
        'high',
        jsonb_build_object(
          'config_price', config_price,
          'service_price', service_price,
          'service_name', 'Over 65" TV Add-on',
          'add_on_key', 'over65'
        )
      );
    END IF;
    
    -- Check frameMount add-on
    config_price := (NEW.pricing_config->'add_ons'->>'frameMount')::NUMERIC;
    SELECT base_price INTO service_price 
    FROM services 
    WHERE name = 'Frame Mount Add-on' AND is_active = true
    LIMIT 1;
    
    IF config_price IS NOT NULL AND service_price IS NOT NULL 
       AND config_price != service_price THEN
      mismatch_count := mismatch_count + 1;
      
      RAISE WARNING 'PRICING MISMATCH: Frame Mount Add-on - config=$%, service=$%', 
        config_price, service_price;
      
      INSERT INTO admin_alerts (alert_type, message, severity, details)
      VALUES (
        'pricing_mismatch',
        'Mount TV pricing_config.add_ons.frameMount does not match "Frame Mount Add-on" base_price',
        'high',
        jsonb_build_object(
          'config_price', config_price,
          'service_price', service_price,
          'service_name', 'Frame Mount Add-on',
          'add_on_key', 'frameMount'
        )
      );
    END IF;
    
    -- Check soundbar add-on
    config_price := (NEW.pricing_config->'add_ons'->>'soundbar')::NUMERIC;
    SELECT base_price INTO service_price 
    FROM services 
    WHERE name = 'Mount Soundbar' AND is_active = true
    LIMIT 1;
    
    IF config_price IS NOT NULL AND service_price IS NOT NULL 
       AND config_price != service_price THEN
      mismatch_count := mismatch_count + 1;
      
      RAISE WARNING 'PRICING MISMATCH: Mount Soundbar - config=$%, service=$%', 
        config_price, service_price;
      
      INSERT INTO admin_alerts (alert_type, message, severity, details)
      VALUES (
        'pricing_mismatch',
        'Mount TV pricing_config.add_ons.soundbar does not match "Mount Soundbar" base_price',
        'high',
        jsonb_build_object(
          'config_price', config_price,
          'service_price', service_price,
          'service_name', 'Mount Soundbar',
          'add_on_key', 'soundbar'
        )
      );
    END IF;
    
    -- Check specialWall add-on (using any of the special wall services)
    config_price := (NEW.pricing_config->'add_ons'->>'specialWall')::NUMERIC;
    SELECT base_price INTO service_price 
    FROM services 
    WHERE name ILIKE '%brick%' OR name ILIKE '%steel%' OR name ILIKE '%concrete%'
    AND is_active = true
    LIMIT 1;
    
    IF config_price IS NOT NULL AND service_price IS NOT NULL 
       AND config_price != service_price THEN
      mismatch_count := mismatch_count + 1;
      
      RAISE WARNING 'PRICING MISMATCH: Special Wall - config=$%, service=$%', 
        config_price, service_price;
      
      INSERT INTO admin_alerts (alert_type, message, severity, details)
      VALUES (
        'pricing_mismatch',
        'Mount TV pricing_config.add_ons.specialWall does not match special wall service base_price',
        'high',
        jsonb_build_object(
          'config_price', config_price,
          'service_price', service_price,
          'add_on_key', 'specialWall'
        )
      );
    END IF;
    
    -- Log success if all prices match
    IF mismatch_count = 0 THEN
      RAISE NOTICE 'Pricing validation passed: All add-on prices are consistent';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to run validation on every update
DROP TRIGGER IF EXISTS check_pricing_consistency ON services;
CREATE TRIGGER check_pricing_consistency
  BEFORE INSERT OR UPDATE ON services
  FOR EACH ROW
  EXECUTE FUNCTION validate_pricing_consistency();