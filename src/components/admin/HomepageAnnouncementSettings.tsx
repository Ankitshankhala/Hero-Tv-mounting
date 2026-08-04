import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Megaphone, Save } from 'lucide-react';
import { HeroAnnouncement } from '@/components/HeroAnnouncement';
import { HERO_ANNOUNCEMENT_MAX_LENGTH, useHeroAnnouncement } from '@/hooks/useHeroAnnouncement';

/**
 * Admin control for the homepage hero announcement pill and the 20% OFF badge.
 * Writes `app_settings` directly — admin-only via RLS.
 */
export const HomepageAnnouncementSettings: React.FC = () => {
  const { toast } = useToast();
  const { settings, loading, reload } = useHeroAnnouncement();

  const [text, setText] = useState('');
  const [announcementEnabled, setAnnouncementEnabled] = useState(false);
  const [promoBadgeEnabled, setPromoBadgeEnabled] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setText(settings.text);
    setAnnouncementEnabled(settings.announcementEnabled);
    setPromoBadgeEnabled(settings.promoBadgeEnabled);
  }, [settings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: userResp } = await supabase.auth.getUser();
      const updatedBy = userResp?.user?.id ?? null;
      const updatedAt = new Date().toISOString();

      const rows: Array<{ key: string; value: string }> = [
        { key: 'hero_announcement_text', value: text.slice(0, HERO_ANNOUNCEMENT_MAX_LENGTH) },
        { key: 'hero_announcement_enabled', value: announcementEnabled ? 'true' : 'false' },
        { key: 'hero_promo_badge_enabled', value: promoBadgeEnabled ? 'true' : 'false' },
      ];

      for (const row of rows) {
        const { data, error } = await supabase
          .from('app_settings')
          .update({ value: row.value, updated_at: updatedAt, updated_by: updatedBy })
          .eq('key', row.key)
          .select('key');

        if (error) throw new Error(`${row.key}: ${error.message}`);
        if (!data || data.length === 0) {
          throw new Error(
            `"${row.key}" was not updated (0 rows). Your account may not have admin permission, so the change was NOT applied.`
          );
        }
      }

      toast({ title: 'Announcement saved', description: 'The homepage hero has been updated.' });
      await reload();
    } catch (e: any) {
      toast({
        title: 'Save failed',
        description: e?.message ?? 'Unexpected error — the announcement was not saved.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const remaining = HERO_ANNOUNCEMENT_MAX_LENGTH - text.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Megaphone className="h-5 w-5" />
          Homepage Announcement
        </CardTitle>
        <CardDescription>
          Controls the pills shown under the phone number in the homepage hero.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading settings…
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <Label htmlFor="hero-announcement-text">Announcement message</Label>
              <Textarea
                id="hero-announcement-text"
                value={text}
                maxLength={HERO_ANNOUNCEMENT_MAX_LENGTH}
                rows={6}
                placeholder="e.g. Holiday hours: closed Dec 25"
                onChange={(e) => setText(e.target.value.slice(0, HERO_ANNOUNCEMENT_MAX_LENGTH))}
              />
              <p className={`text-xs ${remaining === 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                {text.length} / {HERO_ANNOUNCEMENT_MAX_LENGTH} characters
              </p>
            </div>

            <div className="flex items-center justify-between gap-4 py-2 border-t border-border pt-4">
              <div>
                <Label htmlFor="hero-announcement-enabled" className="text-base">Show announcement</Label>
                <p className="text-sm text-muted-foreground">Displays the message above on the homepage hero.</p>
              </div>
              <Switch
                id="hero-announcement-enabled"
                checked={announcementEnabled}
                onCheckedChange={setAnnouncementEnabled}
                disabled={saving}
              />
            </div>

            <div className="flex items-center justify-between gap-4 py-2 border-t border-border pt-4">
              <div>
                <Label htmlFor="hero-promo-badge-enabled" className="text-base">Show 20% OFF badge</Label>
                <p className="text-sm text-muted-foreground">The "20% OFF — already applied" pill.</p>
              </div>
              <Switch
                id="hero-promo-badge-enabled"
                checked={promoBadgeEnabled}
                onCheckedChange={setPromoBadgeEnabled}
                disabled={saving}
              />
            </div>

            <div className="space-y-2">
              <Label>Live preview</Label>
              <div className="rounded-lg bg-gradient-to-r from-slate-900 to-slate-800 p-6 flex justify-center">
                <HeroAnnouncement
                  text={text}
                  announcementEnabled={announcementEnabled}
                  promoBadgeEnabled={promoBadgeEnabled}
                />
              </div>
              {!promoBadgeEnabled && !(announcementEnabled && text.trim()) && (
                <p className="text-xs text-muted-foreground">Nothing will be shown on the hero.</p>
              )}
            </div>

            <div className="flex justify-end">
              <Button onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Save changes
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
