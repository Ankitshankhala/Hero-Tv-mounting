import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, CheckCircle, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface SyncResult {
  success: boolean;
  synced?: number;
  skipped?: number;
  errors?: Array<{ booking_id: string; error: string }>;
  error?: string;
}

export const StripeSyncButton = () => {
  const [syncing, setSyncing] = useState(false);
  const [lastResult, setLastResult] = useState<SyncResult | null>(null);
  const { toast } = useToast();

  const handleSync = async () => {
    setSyncing(true);
    setLastResult(null);

    try {
      console.log('[STRIPE-SYNC] Starting Stripe capture sync...');

      const { data, error } = await supabase.functions.invoke('sync-stripe-captures', {
        body: {}
      });

      if (error) {
        throw error;
      }

      setLastResult(data);

      if (data.success) {
        toast({
          title: "Sync Complete",
          description: `Synced ${data.synced || 0} captures, skipped ${data.skipped || 0}`,
        });
      } else {
        throw new Error(data.error || 'Sync failed');
      }

    } catch (error: any) {
      console.error('[STRIPE-SYNC] Error:', error);
      const errorResult = {
        success: false,
        error: error.message || 'Failed to sync Stripe captures'
      };
      setLastResult(errorResult);

      toast({
        title: "Sync Failed",
        description: errorResult.error,
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="flex items-center space-x-4">
      <Button
        onClick={handleSync}
        disabled={syncing}
        variant="outline"
        size="sm"
      >
        <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
        {syncing ? 'Syncing Stripe...' : 'Sync Stripe Captures'}
      </Button>

      {lastResult && (
        <div className="flex items-center space-x-2">
          {lastResult.success ? (
            <>
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-sm text-green-600">
                {lastResult.synced === 0 
                  ? 'All captures synced'
                  : `${lastResult.synced} captures synced`
                }
              </span>
            </>
          ) : (
            <>
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <span className="text-sm text-red-600">
                {lastResult.error}
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );
};
