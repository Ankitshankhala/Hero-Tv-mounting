
import React from 'react';
import { PublicService } from '@/hooks/usePublicServicesData';

interface TvAddOnsProps {
  over65: boolean;
  setOver65: (value: boolean) => void;
  frameMount: boolean;
  setFrameMount: (value: boolean) => void;
  numberOfTvs: number;
  over65Service?: PublicService;
  frameMountService?: PublicService;
}

export const TvAddOns: React.FC<TvAddOnsProps> = ({
  over65,
  setOver65,
  frameMount,
  setFrameMount,
  numberOfTvs,
  over65Service,
  frameMountService
}) => {
  return (
    <>
      {/* TV Size Add-on */}
      <div className="bg-slate-800 rounded-lg p-4">
        <label className="flex items-center space-x-3 cursor-pointer">
          <input
            type="checkbox"
            checked={over65}
            onChange={(e) => setOver65(e.target.checked)}
            className="w-5 h-5 text-blue-600 bg-slate-700 border-slate-600 rounded focus:ring-blue-500"
          />
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <span className="text-lg font-semibold text-white">Over 65" TV Add-on</span>
              {over65 && (
                <span className="text-green-400 font-semibold">
                  +${ (over65Service?.base_price || 25) * numberOfTvs}
                </span>
              )}
            </div>
            <p className="text-slate-400 text-sm">
              Additional charge for larger TVs (+${over65Service?.base_price || 25} per TV)
            </p>
          </div>
        </label>
      </div>

      {/* Frame Mount Add-on */}
      <div className="bg-slate-800 rounded-lg p-4">
        <label className="flex items-center space-x-3 cursor-pointer">
          <input
            type="checkbox"
            checked={frameMount}
            onChange={(e) => setFrameMount(e.target.checked)}
            className="w-5 h-5 text-blue-600 bg-slate-700 border-slate-600 rounded focus:ring-blue-500"
          />
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <span className="text-lg font-semibold text-white">Frame Mount Add-on</span>
              {frameMount && (
                <span className="text-green-400 font-semibold">
                  +${(frameMountService?.base_price || 25) * numberOfTvs}
                </span>
              )}
            </div>
            <p className="text-slate-400 text-sm">
              Specialized frame mounting service (+${frameMountService?.base_price || 25} per TV)
            </p>
          </div>
        </label>
      </div>
    </>
  );
};
