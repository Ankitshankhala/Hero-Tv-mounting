-- Trigger to keep Mount TV's pricing_config.add_ons in lockstep
-- with the standalone add-on services' base_price.
CREATE OR REPLACE FUNCTION public.sync_tv_addon_prices()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  mount_tv_id   uuid := 'a50013bc-ee03-4452-b3ec-1683094d787a';
  over65_id     uuid := '81194c48-77a8-496e-9d87-f048fe501df0';
  frame_id      uuid := '1b47852d-4cbf-439a-89dc-41bac8bcc20e';
  soundbar_id   uuid := '41ec18d4-516b-4af6-9b05-e38b534923dd';
  special_id    uuid := 'b86fda8c-a667-4dee-b180-3c83d6329c3f';
  cfg jsonb;
BEGIN
  -- Avoid recursion: tag session
  IF current_setting('app.sync_addons_running', true) = 'on' THEN
    RETURN NEW;
  END IF;
  PERFORM set_config('app.sync_addons_running', 'on', true);

  -- CASE A: Mount TV row updated -> push add_ons.* to standalone services
  IF NEW.id = mount_tv_id THEN
    cfg := COALESCE(NEW.pricing_config, '{}'::jsonb);
    IF cfg ? 'add_ons' THEN
      IF cfg->'add_ons' ? 'over65' THEN
        UPDATE services SET base_price = (cfg->'add_ons'->>'over65')::numeric
        WHERE id = over65_id AND base_price <> (cfg->'add_ons'->>'over65')::numeric;
      END IF;
      IF cfg->'add_ons' ? 'frameMount' THEN
        UPDATE services SET base_price = (cfg->'add_ons'->>'frameMount')::numeric
        WHERE id = frame_id AND base_price <> (cfg->'add_ons'->>'frameMount')::numeric;
      END IF;
      IF cfg->'add_ons' ? 'soundbar' THEN
        UPDATE services SET base_price = (cfg->'add_ons'->>'soundbar')::numeric
        WHERE id = soundbar_id AND base_price <> (cfg->'add_ons'->>'soundbar')::numeric;
      END IF;
      IF cfg->'add_ons' ? 'specialWall' THEN
        UPDATE services SET base_price = (cfg->'add_ons'->>'specialWall')::numeric
        WHERE id = special_id AND base_price <> (cfg->'add_ons'->>'specialWall')::numeric;
      END IF;
    END IF;
  END IF;

  -- CASE B: standalone add-on updated -> push base_price into Mount TV.pricing_config.add_ons
  IF NEW.id IN (over65_id, frame_id, soundbar_id, special_id) THEN
    SELECT pricing_config INTO cfg FROM services WHERE id = mount_tv_id;
    cfg := COALESCE(cfg, '{}'::jsonb);
    IF NOT (cfg ? 'add_ons') THEN
      cfg := jsonb_set(cfg, '{add_ons}', '{}'::jsonb, true);
    END IF;
    IF NEW.id = over65_id THEN
      cfg := jsonb_set(cfg, '{add_ons,over65}', to_jsonb(NEW.base_price), true);
    ELSIF NEW.id = frame_id THEN
      cfg := jsonb_set(cfg, '{add_ons,frameMount}', to_jsonb(NEW.base_price), true);
    ELSIF NEW.id = soundbar_id THEN
      cfg := jsonb_set(cfg, '{add_ons,soundbar}', to_jsonb(NEW.base_price), true);
    ELSIF NEW.id = special_id THEN
      cfg := jsonb_set(cfg, '{add_ons,specialWall}', to_jsonb(NEW.base_price), true);
    END IF;
    UPDATE services SET pricing_config = cfg
    WHERE id = mount_tv_id AND pricing_config IS DISTINCT FROM cfg;
  END IF;

  PERFORM set_config('app.sync_addons_running', 'off', true);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_tv_addon_prices ON public.services;
CREATE TRIGGER trg_sync_tv_addon_prices
AFTER UPDATE OF base_price, pricing_config ON public.services
FOR EACH ROW
EXECUTE FUNCTION public.sync_tv_addon_prices();