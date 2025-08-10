import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Bell } from 'lucide-react';

export const NotificationsSettings: React.FC = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [smsEnabled, setSmsEnabled] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('notification_settings')
        .select('sms_enabled, updated_at')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!cancelled) {
        if (error) {
          console.error('Failed to load notification settings', error);
          toast({ title: 'Could not load settings', description: error.message, variant: 'destructive' });
        }
        setSmsEnabled(Boolean(data?.sms_enabled));
        setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [toast]);

  const onToggle = async (checked: boolean) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('notification_settings')
        .insert({ sms_enabled: checked }); // keep history by inserting a new row

      if (error) throw error;

      setSmsEnabled(checked);
      toast({
        title: 'Settings saved',
        description: `SMS notifications ${checked ? 'enabled' : 'disabled'}.`,
      });
    } catch (e: any) {
      console.error('Failed to save notification settings', e);
      toast({ title: 'Save failed', description: e.message ?? 'Unexpected error', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notification Settings
            <Badge variant={smsEnabled ? 'default' : 'secondary'} className="ml-2">
              {smsEnabled ? 'SMS Enabled' : 'SMS Disabled'}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between py-2">
            <div>
              <Label htmlFor="sms-toggle" className="text-base">Enable SMS notifications</Label>
              <p className="text-sm text-gray-500">Controls all SMS messages sent by the system.</p>
            </div>
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Switch
                id="sms-toggle"
                checked={smsEnabled}
                onCheckedChange={onToggle}
                disabled={saving}
              />
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
