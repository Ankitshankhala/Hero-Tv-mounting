import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, Minus, Plus } from 'lucide-react';
import { calculateWorkerEarnings, formatCurrency } from '@/utils/workerEarningsCalculator';

interface BookingService {
  id: string;
  service_name: string;
  quantity: number;
  base_price: number;
}

interface JobEarningsCardProps {
  services: BookingService[];
  tipAmount: number;
  compact?: boolean;
}

export function JobEarningsCard({ services, tipAmount, compact = false }: JobEarningsCardProps) {
  const earnings = calculateWorkerEarnings(services, tipAmount);

  if (compact) {
    // Compact view for WorkerJobCard
    return (
      <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-green-600 dark:text-green-400" />
            <span className="text-sm font-semibold text-green-900 dark:text-green-100">
              Your Earnings:
            </span>
          </div>
          <span className="text-lg font-bold text-green-600 dark:text-green-400">
            {formatCurrency(earnings.totalEarnings)}
          </span>
        </div>
        <div className="mt-1 text-xs text-green-700 dark:text-green-300">
          Commission: {formatCurrency(earnings.workerCommission)}
          {tipAmount > 0 && ` + Tip: ${formatCurrency(tipAmount)}`}
        </div>
      </div>
    );
  }

  // Detailed view for ExpandedJobCard
  return (
    <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-green-200 dark:border-green-800">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2 text-green-900 dark:text-green-100">
          <DollarSign className="h-5 w-5 text-green-600 dark:text-green-400" />
          Your Earnings Breakdown
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Services Total */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-green-800 dark:text-green-200">Services Total:</span>
          <span className="font-semibold text-green-900 dark:text-green-100">
            {formatCurrency(earnings.totalCharged)}
          </span>
        </div>

        {/* Equipment Costs */}
        {earnings.equipmentCosts > 0 && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="text-green-800 dark:text-green-200">Equipment Costs:</span>
              <span className="font-semibold text-red-600 dark:text-red-400">
                <Minus className="inline h-3 w-3" />
                {formatCurrency(earnings.equipmentCosts)}
              </span>
            </div>
            
            {/* Equipment Breakdown */}
            <div className="ml-4 space-y-0.5 text-xs text-green-700 dark:text-green-300">
              {earnings.costBreakdown.fullMotionMountCount > 0 && (
                <div>
                  • Full Motion Mount ({earnings.costBreakdown.fullMotionMountCount}×): {formatCurrency(earnings.costBreakdown.fullMotionMountCost)}
                </div>
              )}
              {earnings.costBreakdown.flatMountCount > 0 && (
                <div>
                  • Flat Mount ({earnings.costBreakdown.flatMountCount}×): {formatCurrency(earnings.costBreakdown.flatMountCost)}
                </div>
              )}
              {earnings.costBreakdown.hideWiresCount > 0 && (
                <div>
                  • Cable Concealment ({earnings.costBreakdown.hideWiresCount}×): {formatCurrency(earnings.costBreakdown.hideWiresCost)}
                </div>
              )}
              {earnings.costBreakdown.fireSafeCount > 0 && (
                <div>
                  • Fire Safe ({earnings.costBreakdown.fireSafeCount}×): {formatCurrency(earnings.costBreakdown.fireSafeCost)}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Divider */}
        <div className="border-t border-green-200 dark:border-green-700"></div>

        {/* Commissionable Amount */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-green-800 dark:text-green-200">Commissionable Amount:</span>
          <span className="font-semibold text-green-900 dark:text-green-100">
            {formatCurrency(earnings.commissionableAmount)}
          </span>
        </div>

        {/* Worker's Share (60%) */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-green-800 dark:text-green-200">Your Share (60%):</span>
          <span className="font-bold text-green-700 dark:text-green-300">
            {formatCurrency(earnings.workerCommission)}
          </span>
        </div>

        {/* Tip */}
        {tipAmount > 0 && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-green-800 dark:text-green-200">Tip:</span>
            <span className="font-semibold text-green-600 dark:text-green-400">
              <Plus className="inline h-3 w-3" />
              {formatCurrency(tipAmount)}
            </span>
          </div>
        )}

        {/* Total Earnings */}
        <div className="pt-3 border-t-2 border-green-300 dark:border-green-600">
          <div className="flex items-center justify-between">
            <span className="font-bold text-green-900 dark:text-green-100">Total You Earn:</span>
            <span className="text-2xl font-bold text-green-600 dark:text-green-400">
              {formatCurrency(earnings.totalEarnings)}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
