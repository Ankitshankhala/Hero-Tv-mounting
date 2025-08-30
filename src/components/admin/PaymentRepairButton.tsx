import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Wrench, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface RepairResult {
  promoted_bookings: number;
  backfilled_payment_intents: number;
  standardized_statuses: number;
  errors: number;
  details?: string[];
}

export const PaymentRepairButton = () => {
  const [repairing, setRepairing] = useState(false);
  const [lastRepairResult, setLastRepairResult] = useState<RepairResult | null>(null);
  const { toast } = useToast();

  const handleRepair = async () => {
    setRepairing(true);
    setLastRepairResult(null);

    try {
      console.log('Starting payment inconsistency repair...');

      // Call the repair function
      const { data, error } = await supabase.rpc('repair_payment_inconsistencies');

      if (error) {
        throw error;
      }

      const result = data as unknown as RepairResult;
      setLastRepairResult(result);

      const totalFixed = result.promoted_bookings + result.backfilled_payment_intents + result.standardized_statuses;

      if (totalFixed > 0) {
        toast({
          title: "Repair Complete",
          description: `Fixed ${totalFixed} payment inconsistencies (${result.promoted_bookings} promoted, ${result.backfilled_payment_intents} backfilled, ${result.standardized_statuses} standardized)`,
        });
      } else {
        toast({
          title: "No Issues Found",
          description: "All payment records are already consistent",
        });
      }

      if (result.errors > 0) {
        toast({
          title: "Partial Success",
          description: `${result.errors} errors occurred during repair. Check logs for details.`,
          variant: "destructive",
        });
      }

    } catch (error: any) {
      console.error('Payment repair error:', error);
      const errorResult = {
        promoted_bookings: 0,
        backfilled_payment_intents: 0,
        standardized_statuses: 0,
        errors: 1
      };
      setLastRepairResult(errorResult);

      toast({
        title: "Repair Failed",
        description: error.message || 'Failed to repair payment inconsistencies',
        variant: "destructive",
      });
    } finally {
      setRepairing(false);
    }
  };

  return (
    <div className="flex items-center space-x-4">
      <Button
        onClick={handleRepair}
        disabled={repairing}
        variant="outline"
        size="sm"
        className="text-orange-600 border-orange-200 hover:bg-orange-50"
      >
        {repairing ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <Wrench className="h-4 w-4 mr-2" />
        )}
        {repairing ? 'Repairing...' : 'Repair Payment Issues'}
      </Button>

      {lastRepairResult && (
        <div className="flex items-center space-x-2">
          {lastRepairResult.errors === 0 ? (
            <>
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-sm text-green-600">
                {lastRepairResult.promoted_bookings + lastRepairResult.backfilled_payment_intents + lastRepairResult.standardized_statuses === 0 
                  ? 'No issues found - all systems consistent'
                  : `Repaired ${lastRepairResult.promoted_bookings + lastRepairResult.backfilled_payment_intents + lastRepairResult.standardized_statuses} issues`
                }
              </span>
            </>
          ) : (
            <>
              <AlertTriangle className="h-4 w-4 text-orange-600" />
              <span className="text-sm text-orange-600">
                {lastRepairResult.errors} errors during repair
              </span>
            </>
          )}
        </div>
      )}

      {lastRepairResult && (lastRepairResult.promoted_bookings > 0 || lastRepairResult.backfilled_payment_intents > 0 || lastRepairResult.standardized_statuses > 0) && (
        <div className="text-xs text-muted-foreground">
          Promoted: {lastRepairResult.promoted_bookings} | 
          Backfilled: {lastRepairResult.backfilled_payment_intents} | 
          Standardized: {lastRepairResult.standardized_statuses}
        </div>
      )}
    </div>
  );
};