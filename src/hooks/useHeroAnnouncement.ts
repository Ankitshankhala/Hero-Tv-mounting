import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const HERO_ANNOUNCEMENT_MAX_LENGTH = 120;

export const HERO_SETTING_KEYS = [
  'hero_announcement_text',
  'hero_announcement_enabled',
  'hero_promo_badge_enabled',
] as const;

export interface HeroAnnouncementSettings {
  text: string;
  announcementEnabled: boolean;
  promoBadgeEnabled: boolean;
}

const DEFAULTS: HeroAnnouncementSettings = {
  text: '',
  announcementEnabled: false,
  promoBadgeEnabled: true,
};

const isTrue = (v: unknown) => String(v ?? '').trim().toLowerCase() === 'true';

/**
 * Reads the three `app_settings` keys that drive the homepage hero
 * announcement / promo badge. Public read (anon + authenticated).
 */
export const useHeroAnnouncement = () => {
  const [settings, setSettings] = useState<HeroAnnouncementSettings>(DEFAULTS);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('key, value')
        .in('key', HERO_SETTING_KEYS as unknown as string[]);

      if (error) throw error;

      const map = new Map((data ?? []).map((r: any) => [r.key, r.value]));
      setSettings({
        text: String(map.get('hero_announcement_text') ?? '').slice(0, HERO_ANNOUNCEMENT_MAX_LENGTH),
        announcementEnabled: isTrue(map.get('hero_announcement_enabled')),
        promoBadgeEnabled: map.has('hero_promo_badge_enabled')
          ? isTrue(map.get('hero_promo_badge_enabled'))
          : DEFAULTS.promoBadgeEnabled,
      });
    } catch {
      setSettings(DEFAULTS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { settings, loading, reload: load };
};
