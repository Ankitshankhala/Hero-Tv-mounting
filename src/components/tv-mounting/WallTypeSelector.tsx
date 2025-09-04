
import React from 'react';
import { Check } from 'lucide-react';
import { PublicService } from '@/hooks/usePublicServicesData';

interface WallTypeSelectorProps {
  wallType: string;
  setWallType: (type: string) => void;
  numberOfTvs: number;
  stoneWallService?: PublicService;
}

export const WallTypeSelector: React.FC<WallTypeSelectorProps> = ({
  wallType,
  setWallType,
  numberOfTvs,
  stoneWallService
}) => {
  const wallTypeOptions = [
    { value: 'standard', label: 'Standard Drywall' },
    { value: 'steel', label: 'Steel' },
    { value: 'brick', label: 'Brick' },
    { value: 'concrete', label: 'Concrete' }
  ];

  return (
    <div className="bg-slate-800 rounded-lg p-4">
      <label className="block text-lg font-semibold text-white mb-3">
        Wall Type
      </label>
      <div className="grid grid-cols-2 gap-3">
        {wallTypeOptions.map((option) => (
          <button
            key={option.value}
            onClick={() => setWallType(option.value)}
            className={`relative p-3 rounded-lg border-2 transition-all ${
              wallType === option.value
                ? 'border-blue-500 bg-blue-500/20 text-white'
                : 'border-slate-600 bg-slate-700 text-slate-300 hover:border-slate-500'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-medium">{option.label}</span>
              {wallType === option.value && (
                <Check className="h-4 w-4 text-blue-400" />
              )}
            </div>
            <div className="text-left">
              {option.value === 'standard' ? (
                <p className="text-xs text-slate-400 mt-1">No extra charge</p>
              ) : (
                <div className="text-xs mt-1">
                  <p className="text-slate-400">
                    +${stoneWallService?.base_price || 40} per TV
                  </p>
                  {wallType === option.value && (
                    <p className="text-green-400 font-semibold">
                      Total: +${(stoneWallService?.base_price || 40) * numberOfTvs}
                    </p>
                  )}
                </div>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};
