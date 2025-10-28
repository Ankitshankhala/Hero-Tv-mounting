import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trash2, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';

export const CleanupMonitor = () => {
  const { toast } = useToast();
  const [isCleaningNow, setIsCleaningNow] = useState(false);

  // Query current pending bookings
  const { data: pendingStats, refetch } = useQuery<{
    totalPending: number;
    expiredCount: number;
  }>({
    queryKey: ['pending-bookings-stats'],
    queryFn: async () => {
      const threeHoursAgo = new Date(Date.now() - 180 * 60 * 1000).toISOString();
      
      const totalResult = await supabase
        .from('bookings')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'payment_pending');

      const expiredResult = await supabase
        .from('bookings')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'payment_pending')
        .lt('created_at', threeHoursAgo);

      return {
        totalPending: totalResult.count || 0,
        expiredCount: expiredResult.count || 0,
      };
    },
    refetchInterval: 30000,
  });

  // Query cleanup history from sms_logs
  const { data: cleanupHistory } = useQuery<Array<{
    id: string;
    sent_at: string;
    message: string;
    phone_number: string;
    status: string;
  }>>({
    queryKey: ['cleanup-history'],
    queryFn: async () => {
      const { data } = await supabase
        .from('sms_logs')
        .select('*')
        .eq('phone_number', 'SYSTEM')
        .like('message', '%cleanup%')
        .order('sent_at', { ascending: false })
        .limit(5);

      return data || [];
    },
    refetchInterval: 60000,
  });

  const handleManualCleanup = async () => {
    setIsCleaningNow(true);
    try {
      const { data, error } = await supabase.functions.invoke('cleanup-pending-bookings', {
        body: { manual: true }
      });

      if (error) throw error;

      toast({
        title: "Cleanup Complete",
        description: `Removed ${data.deleted_count} expired bookings and canceled ${data.canceled_intents} payment intents.`,
      });

      refetch();
    } catch (error: any) {
      toast({
        title: "Cleanup Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsCleaningNow(false);
    }
  };

  const lastCleanup = cleanupHistory?.[0];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Automated Cleanup Monitor
            </CardTitle>
            <CardDescription>
              3-hour expiration for payment_pending bookings
            </CardDescription>
          </div>
          <Button
            onClick={handleManualCleanup}
            disabled={isCleaningNow}
            size="sm"
            variant="outline"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Clean Now
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Status */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 border rounded-lg">
            <div className="text-2xl font-bold">{pendingStats?.totalPending || 0}</div>
            <div className="text-sm text-muted-foreground">Total Pending</div>
          </div>
          <div className="p-4 border rounded-lg">
            <div className="text-2xl font-bold text-destructive">
              {pendingStats?.expiredCount || 0}
            </div>
            <div className="text-sm text-muted-foreground">Ready to Clean</div>
          </div>
        </div>

        {/* Alert if bookings need cleanup */}
        {pendingStats && pendingStats.expiredCount > 0 && (
          <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
            <AlertCircle className="h-4 w-4 text-destructive" />
            <span className="text-sm">
              {pendingStats.expiredCount} booking(s) older than 3 hours awaiting cleanup
            </span>
          </div>
        )}

        {/* Last Cleanup Info */}
        {lastCleanup && (
          <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
            <CheckCircle className="h-4 w-4 text-primary" />
            <div className="flex-1 text-sm">
              <div className="font-medium">Last Cleanup</div>
              <div className="text-muted-foreground">
                {formatDistanceToNow(new Date(lastCleanup.sent_at), { addSuffix: true })}
              </div>
            </div>
          </div>
        )}

        {/* Cleanup History */}
        <div>
          <h4 className="text-sm font-medium mb-2">Recent Cleanup History</h4>
          <div className="space-y-2">
            {cleanupHistory?.slice(0, 3).map((log) => (
              <div
                key={log.id}
                className="text-xs p-2 bg-muted/50 rounded border"
              >
                <div className="flex items-center justify-between mb-1">
                  <Badge variant="outline" className="text-xs">
                    {new Date(log.sent_at).toLocaleString()}
                  </Badge>
                </div>
                <div className="text-muted-foreground">{log.message}</div>
              </div>
            ))}
            {!cleanupHistory?.length && (
              <div className="text-sm text-muted-foreground text-center py-2">
                No cleanup history yet
              </div>
            )}
          </div>
        </div>

        {/* Info */}
        <div className="text-xs text-muted-foreground border-t pt-3">
          <p>
            • Automated cleanup runs every hour (at :00)
          </p>
          <p>
            • Bookings in payment_pending status older than 3 hours are removed
          </p>
          <p>
            • Associated Stripe PaymentIntents are canceled automatically
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
