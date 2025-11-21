import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

export const DataRepairButton = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [dryRunResults, setDryRunResults] = useState<any>(null);
  const [isOpen, setIsOpen] = useState(false);

  const runDryRun = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('repair-tip-calculations', {
        body: { dryRun: true }
      });

      if (error) throw error;

      setDryRunResults(data.results);
      toast({
        title: 'Dry Run Complete',
        description: `Found issues: ${data.results.step1_backfill.details?.length || 0} missing services, ${data.results.step2_transactions.details?.length || 0} incorrect transactions`,
      });
    } catch (error: any) {
      console.error('Dry run error:', error);
      toast({
        title: 'Dry Run Failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const runRepair = async () => {
    if (!confirm(
      'This will modify historical data to fix tip calculations. This cannot be undone easily. Continue?'
    )) {
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('repair-tip-calculations', {
        body: { dryRun: false }
      });

      if (error) throw error;

      toast({
        title: 'Data Repair Complete',
        description: `Repaired: ${data.results.step1_backfill.affected} services, ${data.results.step2_transactions.affected} transactions, ${data.results.step3_bookings.affected} bookings`,
      });
      
      setDryRunResults(null);
      setIsOpen(false);
    } catch (error: any) {
      console.error('Repair error:', error);
      toast({
        title: 'Repair Failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <AlertCircle className="h-4 w-4" />
          Repair Tip Calculations
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Phase 2: Repair Historical Data</DialogTitle>
          <DialogDescription>
            This tool repairs corrupted tip calculations in historical bookings by:
            <ol className="list-decimal list-inside mt-2 space-y-1">
              <li>Backfilling missing booking_services records</li>
              <li>Recalculating transaction amounts (base_amount, tip_amount)</li>
              <li>Syncing bookings.tip_amount with corrected values</li>
            </ol>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!dryRunResults ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                First, run a dry run to see what would be changed without modifying any data.
              </p>
              <Button 
                onClick={runDryRun} 
                disabled={loading}
                className="w-full"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Running Dry Run...
                  </>
                ) : (
                  'Run Dry Run (Safe)'
                )}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
                <h4 className="font-semibold flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  Dry Run Results
                </h4>
                
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="font-medium">Missing Services:</span> {dryRunResults.step1_backfill.details?.length || 0} bookings need backfilling
                  </div>
                  <div>
                    <span className="font-medium">Incorrect Transactions:</span> {dryRunResults.step2_transactions.details?.length || 0} transactions need correction
                  </div>
                  <div>
                    <span className="font-medium">Booking Tip Sync:</span> {dryRunResults.step3_bookings.details?.length || 0} bookings need tip sync
                  </div>
                </div>

                {dryRunResults.step1_backfill.details?.length > 0 && (
                  <details className="text-xs">
                    <summary className="cursor-pointer font-medium">View Sample Details</summary>
                    <pre className="mt-2 overflow-x-auto bg-background p-2 rounded border">
                      {JSON.stringify(dryRunResults.step1_backfill.details.slice(0, 3), null, 2)}
                    </pre>
                  </details>
                )}
              </div>

              <div className="flex gap-2">
                <Button 
                  onClick={() => setDryRunResults(null)}
                  variant="outline"
                  className="flex-1"
                >
                  Run Again
                </Button>
                <Button 
                  onClick={runRepair}
                  disabled={loading}
                  variant="default"
                  className="flex-1"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Repairing...
                    </>
                  ) : (
                    'Apply Repairs'
                  )}
                </Button>
              </div>

              <p className="text-xs text-muted-foreground">
                ⚠️ This will modify historical data. All changes are logged in booking_audit_log.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
