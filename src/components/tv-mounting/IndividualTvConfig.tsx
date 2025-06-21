
import React from 'react';
import { Check } from 'lucide-react';
import { PublicService } from '@/hooks/usePublicServicesData';

interface TvConfiguration {
  id: string;
  over65: boolean;
  frameMount: boolean;
  wallType: string;
}

interface IndividualTvConfigProps {
  tvConfig: TvConfiguration;
  tvNumber: number;
  onUpdateConfig: (tvId: string, updates: Partial<Omit<TvConfiguration, 'id'>>) => void;
  over65Service?: PublicService;
  frameMountService?: PublicService;
  stoneWallService?: PublicService;
}

export const IndividualTvConfig: React.FC<IndividualTvConfigProps> = ({
  tvConfig,
  tvNumber,
  onUpdateConfig,
  over65Service,
  frameMountService,
  stoneWallService
}) => {
  const wallTypeOptions = [
    { value: 'standard', label: 'Standard Drywall' },
    { value: 'stone', label: 'Stone' },
    { value: 'brick', label: 'Brick' },
    { value: 'tile', label: 'Tile' }
  ];

  return (
    <div className="bg-slate-700 rounded-lg p-4 border border-slate-600">
      <h4 className="text-lg font-semibold text-white mb-4">
        TV #{tvNumber} Configuration
      </h4>
      
      <div className="space-y-4">
        {/* Over 65" TV Add-on */}
        <div className="bg-slate-800 rounded-lg p-3">
          <label className="flex items-center space-x-3 cursor-pointer">
            <input
              type="checkbox"
              checked={tvConfig.over65}
              onChange={(e) => onUpdateConfig(tvConfig.id, { over65: e.target.checked })}
              className="w-4 h-4 text-blue-600 bg-slate-700 border-slate-600 rounded focus:ring-blue-500"
            />
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="font-medium text-white">Over 65" TV Add-on</span>
                {tvConfig.over65 && (
                  <span className="text-green-400 font-semibold">
                    +${over65Service?.base_price || 25}
                  </span>
                )}
              </div>
              <p className="text-slate-400 text-xs">
                Additional charge for larger TVs (+${over65Service?.base_price || 25})
              </p>
            </div>
          </label>
        </div>

        {/* Frame Mount Add-on */}
        <div className="bg-slate-800 rounded-lg p-3">
          <label className="flex items-center space-x-3 cursor-pointer">
            <input
              type="checkbox"
              checked={tvConfig.frameMount}
              onChange={(e) => onUpdateConfig(tvConfig.id, { frameMount: e.target.checked })}
              className="w-4 h-4 text-blue-600 bg-slate-700 border-slate-600 rounded focus:ring-blue-500"
            />
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="font-medium text-white">Frame Mount Add-on</span>
                {tvConfig.frameMount && (
                  <span className="text-green-400 font-semibold">
                    +${frameMountService?.base_price || 25}
                  </span>
                )}
              </div>
              <p className="text-slate-400 text-xs">
                Specialized frame mounting service (+${frameMountService?.base_price || 25})
              </p>
            </div>
          </label>
        </div>

        {/* Wall Type */}
        <div className="bg-slate-800 rounded-lg p-3">
          <label className="block font-medium text-white mb-2">Wall Type</label>
          <div className="grid grid-cols-2 gap-2">
            {wallTypeOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => onUpdateConfig(tvConfig.id, { wallType: option.value })}
                className={`relative p-2 rounded-lg border transition-all text-sm ${
                  tvConfig.wallType === option.value
                    ? 'border-blue-500 bg-blue-500/20 text-white'
                    : 'border-slate-600 bg-slate-600 text-slate-300 hover:border-slate-500'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{option.label}</span>
                  {tvConfig.wallType === option.value && (
                    <Check className="h-3 w-3 text-blue-400" />
                  )}
                </div>
                <div className="text-left mt-1">
                  {option.value === 'standard' ? (
                    <p className="text-xs text-slate-400">No extra charge</p>
                  ) : (
                    <div className="text-xs">
                      <p className="text-slate-400">
                        +${stoneWallService?.base_price || 50}
                      </p>
                      {tvConfig.wallType === option.value && (
                        <p className="text-green-400 font-semibold">
                          +${stoneWallService?.base_price || 50}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
