
import React from 'react';
import { PublicService } from '@/hooks/usePublicServicesData';
import { getAddOnPrice } from '@/utils/pricingDisplay';

interface TvAddOnsProps {
  over65: boolean;
  setOver65: (value: boolean) => void;
  frameMount: boolean;
  setFrameMount: (value: boolean) => void;
  numberOfTvs: number;
  tvMountingService?: PublicService;
  over65Service?: PublicService;
  frameMountService?: PublicService;
}

export const TvAddOns: React.FC<TvAddOnsProps> = ({
  over65,
  setOver65,
  frameMount,
  setFrameMount,
  numberOfTvs,
  tvMountingService,
  over65Service,
  frameMountService
}) => {
  // Use getAddOnPrice without default fallbacks - prices now come from database
  const over65Price = getAddOnPrice(tvMountingService, 'over65', over65Service);
  const frameMountPrice = getAddOnPrice(tvMountingService, 'frameMount', frameMountService);
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
                  +${over65Price * numberOfTvs}
                </span>
              )}
            </div>
            <p className="text-slate-400 text-sm">
              Additional charge for larger TVs (+${over65Price} per TV)
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
                  +${frameMountPrice * numberOfTvs}
                </span>
              )}
            </div>
            <p className="text-slate-400 text-sm">
              Specialized frame mounting service (+${frameMountPrice} per TV)
            </p>
          </div>
        </label>
      </div>
    </>
  );
};
