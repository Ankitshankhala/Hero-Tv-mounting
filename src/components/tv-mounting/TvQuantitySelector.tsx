
import React from 'react';
import { Plus, Minus } from 'lucide-react';
import { formatTieredPricing } from '@/utils/pricingDisplay';
import { ServiceLike } from '@/utils/pricingEngine';

interface TvQuantitySelectorProps {
  numberOfTvs: number;
  onIncrement: () => void;
  onDecrement: () => void;
  calculateTvMountingPrice: (numTvs: number) => number;
  tvMountingService?: ServiceLike;
}

export const TvQuantitySelector: React.FC<TvQuantitySelectorProps> = ({
  numberOfTvs,
  onIncrement,
  onDecrement,
  calculateTvMountingPrice,
  tvMountingService
}) => {
  const pricingBreakdown = formatTieredPricing(tvMountingService);
  return (
    <div className="bg-muted rounded-lg p-4">
      <label className="block text-lg font-semibold text-card-foreground mb-3">
        Number of TVs
      </label>
      <div className="flex items-center space-x-4">
        <button
          onClick={onDecrement}
          disabled={numberOfTvs <= 1}
          className={`p-2 rounded-lg transition-colors ${
            numberOfTvs <= 1
              ? 'bg-secondary text-muted-foreground cursor-not-allowed'
              : 'bg-secondary text-secondary-foreground hover:bg-accent'
          }`}
        >
          <Minus className="h-4 w-4" />
        </button>
        <div className="bg-secondary px-6 py-2 rounded-lg">
          <span className="text-xl font-semibold text-secondary-foreground">{numberOfTvs}</span>
        </div>
        <button
          onClick={onIncrement}
          disabled={numberOfTvs >= 5}
          className={`p-2 rounded-lg transition-colors ${
            numberOfTvs >= 5
              ? 'bg-secondary text-muted-foreground cursor-not-allowed'
              : 'bg-secondary text-secondary-foreground hover:bg-accent'
          }`}
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-3 text-sm text-muted-foreground">
        <div>Base TV Mounting: ${calculateTvMountingPrice(numberOfTvs)}</div>
        {numberOfTvs > 1 && pricingBreakdown && (
          <div className="text-xs mt-1">
            {pricingBreakdown}
          </div>
        )}
      </div>
    </div>
  );
};
