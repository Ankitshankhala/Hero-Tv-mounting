import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, DollarSign } from 'lucide-react';

interface RealTimePriceDisplayProps {
  originalPrice: number;
  currentPrice: number;
  difference: number;
}

export const RealTimePriceDisplay: React.FC<RealTimePriceDisplayProps> = ({
  originalPrice,
  currentPrice,
  difference
}) => {
  const isIncrease = difference > 0;
  const isDecrease = difference < 0;
  const noChange = difference === 0;

  const getDifferenceColor = () => {
    if (isIncrease) return 'text-green-400';
    if (isDecrease) return 'text-red-400';
    return 'text-slate-400';
  };

  const getDifferenceIcon = () => {
    if (isIncrease) return <TrendingUp className="h-4 w-4" />;
    if (isDecrease) return <TrendingDown className="h-4 w-4" />;
    return <DollarSign className="h-4 w-4" />;
  };

  const getDifferenceBadge = () => {
    if (noChange) return null;
    
    const variant = isIncrease ? 'default' : 'destructive';
    const prefix = isIncrease ? '+' : '';
    
    return (
      <Badge variant={variant} className="ml-2">
        {prefix}${difference.toFixed(2)}
      </Badge>
    );
  };

  return (
    <Card className="bg-slate-900 border-slate-600 mb-6">
      <CardHeader>
        <CardTitle className="text-white flex items-center">
          <DollarSign className="h-5 w-5 mr-2" />
          Price Summary
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Original Price */}
          <div className="text-center">
            <div className="text-sm text-slate-400 mb-1">Original Total</div>
            <div className="text-2xl font-bold text-white">
              ${originalPrice.toFixed(2)}
            </div>
          </div>

          {/* Current Price */}
          <div className="text-center">
            <div className="text-sm text-slate-400 mb-1">Current Total</div>
            <div className="text-2xl font-bold text-white">
              ${currentPrice.toFixed(2)}
            </div>
          </div>

          {/* Difference */}
          <div className="text-center">
            <div className="text-sm text-slate-400 mb-1">Difference</div>
            <div className={`text-2xl font-bold flex items-center justify-center ${getDifferenceColor()}`}>
              {getDifferenceIcon()}
              <span className="ml-1">
                {noChange ? '$0.00' : `${isIncrease ? '+' : ''}$${Math.abs(difference).toFixed(2)}`}
              </span>
            </div>
            {!noChange && (
              <div className="text-sm mt-1">
                {isIncrease ? 'Additional charge' : 'Refund amount'}
              </div>
            )}
          </div>
        </div>

        {/* Real-time update indicator */}
        <div className="mt-4 pt-4 border-t border-slate-700">
          <div className="flex items-center justify-center text-sm text-slate-400">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse mr-2"></div>
            Real-time price updates enabled
          </div>
        </div>
      </CardContent>
    </Card>
  );
};