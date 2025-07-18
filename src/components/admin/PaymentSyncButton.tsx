import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, AlertTriangle, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const PaymentSyncButton = () => {
  const [syncing, setSyncing] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<{
    success: boolean;
    count?: number;
    error?: string;
  } | null>(null);
  const { toast } = useToast();

  const handleSync = async () => {
    setSyncing(true);
    setLastSyncResult(null);

    try {
      console.log('Starting payment transaction sync...');

      // Call the sync function to create missing transactions
      const { data, error } = await supabase.functions.invoke('sync-payment-transactions', {
        body: {
          action: 'create_missing_transactions'
        }
      });

      if (error) {
        throw error;
      }

      const result = data;
      setLastSyncResult(result);

      if (result.success) {
        toast({
          title: "Sync Complete",
          description: `Created ${result.count || 0} missing transaction records`,
        });
      } else {
        throw new Error(result.error || 'Sync failed');
      }

    } catch (error: any) {
      console.error('Payment sync error:', error);
      const errorResult = {
        success: false,
        error: error.message || 'Failed to sync payment transactions'
      };
      setLastSyncResult(errorResult);

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
        {syncing ? 'Syncing...' : 'Sync Missing Transactions'}
      </Button>

      {lastSyncResult && (
        <div className="flex items-center space-x-2">
          {lastSyncResult.success ? (
            <>
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-sm text-green-600">
                {lastSyncResult.count === 0 
                  ? 'All transactions up to date'
                  : `${lastSyncResult.count} transactions created`
                }
              </span>
            </>
          ) : (
            <>
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <span className="text-sm text-red-600">
                {lastSyncResult.error}
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );
};