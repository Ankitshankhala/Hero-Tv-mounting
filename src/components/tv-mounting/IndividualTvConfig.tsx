
import React from 'react';
import { Check } from 'lucide-react';
import { PublicService } from '@/hooks/usePublicServicesData';

interface TvConfiguration {
  id: string;
  over65: boolean;
  frameMount: boolean;
  wallType: string;
  soundbar: boolean;
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

        {/* Stone/Brick/Tile Wall Add-on */}
        <div className="bg-slate-800 rounded-lg p-3">
          <label className="flex items-center space-x-3 cursor-pointer">
            <input
              type="checkbox"
              checked={tvConfig.wallType !== 'standard'}
              onChange={(e) => onUpdateConfig(tvConfig.id, { wallType: e.target.checked ? 'stone' : 'standard' })}
              className="w-4 h-4 text-blue-600 bg-slate-700 border-slate-600 rounded focus:ring-blue-500"
            />
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="font-medium text-white">Stone/Brick/Steel/Tile Wall</span>
                {tvConfig.wallType !== 'standard' && (
                  <span className="text-green-400 font-semibold">
                    +${stoneWallService?.base_price || 50}
                  </span>
                )}
              </div>
              <p className="text-slate-400 text-xs">
                Additional charge for specialty wall surfaces (+${stoneWallService?.base_price || 50})
              </p>
            </div>
          </label>
        </div>

        {/* Mount Soundbar Add-on */}
        <div className="bg-slate-800 rounded-lg p-3">
          <label className="flex items-center space-x-3 cursor-pointer">
            <input
              type="checkbox"
              checked={tvConfig.soundbar}
              onChange={(e) => onUpdateConfig(tvConfig.id, { soundbar: e.target.checked })}
              className="w-4 h-4 text-blue-600 bg-slate-700 border-slate-600 rounded focus:ring-blue-500"
            />
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="font-medium text-white">Mount Soundbar</span>
                {tvConfig.soundbar && (
                  <span className="text-green-400 font-semibold">
                    +$40
                  </span>
                )}
              </div>
              <p className="text-slate-400 text-xs">
                Professional soundbar mounting service (+$40)
              </p>
            </div>
          </label>
        </div>
      </div>
    </div>
  );
};
