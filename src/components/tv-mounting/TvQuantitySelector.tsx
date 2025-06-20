
import React from 'react';
import { Plus, Minus } from 'lucide-react';

interface TvQuantitySelectorProps {
  numberOfTvs: number;
  onIncrement: () => void;
  onDecrement: () => void;
  calculateTvMountingPrice: (numTvs: number) => number;
}

export const TvQuantitySelector: React.FC<TvQuantitySelectorProps> = ({
  numberOfTvs,
  onIncrement,
  onDecrement,
  calculateTvMountingPrice
}) => {
  return (
    <div className="bg-slate-800 rounded-lg p-4">
      <label className="block text-lg font-semibold text-white mb-3">
        Number of TVs
      </label>
      <div className="flex items-center space-x-4">
        <button
          onClick={onDecrement}
          disabled={numberOfTvs <= 1}
          className={`p-2 rounded-lg transition-colors ${
            numberOfTvs <= 1
              ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
              : 'bg-slate-700 text-white hover:bg-slate-600'
          }`}
        >
          <Minus className="h-4 w-4" />
        </button>
        <div className="bg-slate-700 px-6 py-2 rounded-lg">
          <span className="text-xl font-semibold text-white">{numberOfTvs}</span>
        </div>
        <button
          onClick={onIncrement}
          disabled={numberOfTvs >= 5}
          className={`p-2 rounded-lg transition-colors ${
            numberOfTvs >= 5
              ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
              : 'bg-slate-700 text-white hover:bg-slate-600'
          }`}
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-3 text-sm text-slate-400">
        <div>Base TV Mounting: ${calculateTvMountingPrice(numberOfTvs)}</div>
        {numberOfTvs > 1 && (
          <div className="text-xs mt-1">
            1st TV: $90, 2nd TV: $60{numberOfTvs > 2 && `, Additional TVs: $75 each`}
          </div>
        )}
      </div>
    </div>
  );
};
