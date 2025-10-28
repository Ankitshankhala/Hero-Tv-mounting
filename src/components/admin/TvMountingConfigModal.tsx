
import React from 'react';
import { X, Monitor, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PublicService } from '@/hooks/usePublicServicesData';
import { useTvMountingModal } from '@/hooks/useTvMountingModal';

interface TvMountingConfig {
  numberOfTvs: number;
  tvConfigurations: Array<{
    id: string;
    over65: boolean;
    frameMount: boolean;
    wallType: string;
    soundbar: boolean;
  }>;
  totalPrice: number;
  services: Array<{
    id: string;
    name: string;
    price: number;
    quantity: number;
  }>;
}

interface TvMountingConfigModalProps {
  open: boolean;
  onClose: () => void;
  onConfigComplete: (config: TvMountingConfig) => void;
  services: PublicService[];
  initialConfig?: TvMountingConfig | null;
}

export const TvMountingConfigModal: React.FC<TvMountingConfigModalProps> = ({
  open,
  onClose,
  onConfigComplete,
  services,
  initialConfig
}) => {
  const {
    numberOfTvs,
    setNumberOfTvs,
    tvConfigurations,
    updateTvConfiguration,
    over65Service,
    frameMountService,
    stoneWallService,
    totalPrice,
    calculateTvMountingPrice,
    buildServicesList,
    buildCartItemName
  } = useTvMountingModal(services);

  // Initialize with existing config if provided
  React.useEffect(() => {
    if (initialConfig) {
      setNumberOfTvs(initialConfig.numberOfTvs);
    }
  }, [initialConfig, setNumberOfTvs]);

  if (!open) {
    return null;
  }

  const incrementTvs = () => {
    if (numberOfTvs < 5) {
      setNumberOfTvs(numberOfTvs + 1);
    }
  };

  const decrementTvs = () => {
    if (numberOfTvs > 1) {
      setNumberOfTvs(numberOfTvs - 1);
    }
  };

  const handleComplete = () => {
    const config: TvMountingConfig = {
      numberOfTvs,
      tvConfigurations,
      totalPrice,
      services: buildServicesList()
    };
    onConfigComplete(config);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 flex justify-between items-center sticky top-0 bg-white z-10">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 flex items-center">
              <Monitor className="mr-3 h-6 w-6 text-blue-500" />
              Mount TV Configuration
            </h2>
            <p className="text-gray-600 mt-1">Configure Mount TV options for this booking</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-2 hover:bg-gray-100 rounded-lg"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* TV Quantity Selector */}
          <div className="bg-gray-50 rounded-lg p-4">
            <label className="block text-lg font-semibold text-gray-900 mb-3">
              Number of TVs
            </label>
            <div className="flex items-center space-x-4">
              <button
                onClick={decrementTvs}
                disabled={numberOfTvs <= 1}
                className={`p-2 rounded-lg transition-colors ${
                  numberOfTvs <= 1
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                -
              </button>
              <div className="bg-white px-6 py-2 rounded-lg border">
                <span className="text-xl font-semibold text-gray-900">{numberOfTvs}</span>
              </div>
              <button
                onClick={incrementTvs}
                disabled={numberOfTvs >= 5}
                className={`p-2 rounded-lg transition-colors ${
                  numberOfTvs >= 5
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                +
              </button>
            </div>
            <div className="mt-3 text-sm text-gray-600">
              <div>Base Mount TV: ${calculateTvMountingPrice(numberOfTvs)}</div>
              {numberOfTvs > 1 && (
                <div className="text-xs mt-1">
                  1st TV: $90, 2nd TV: $85{numberOfTvs > 2 && `, Additional TVs: $75 each`}
                </div>
              )}
            </div>
          </div>

          {/* Individual TV Configurations */}
          <div className="space-y-4">
            <h3 className="text-xl font-semibold text-gray-900">Configure Each TV</h3>
            {tvConfigurations.map((config, index) => (
              <div key={config.id} className="bg-gray-50 rounded-lg p-4 border">
                <h4 className="text-lg font-semibold text-gray-900 mb-4">
                  TV #{index + 1} Configuration
                </h4>
                
                <div className="space-y-4">
                  {/* Over 65" TV Add-on */}
                  <div className="bg-white rounded-lg p-3 border">
                    <label className="flex items-center space-x-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config.over65}
                        onChange={(e) => updateTvConfiguration(config.id, { over65: e.target.checked })}
                        className="w-4 h-4 text-blue-600 bg-white border-gray-300 rounded focus:ring-blue-500"
                      />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-gray-900">Over 65" TV Add-on</span>
                          {config.over65 && (
                            <span className="text-green-600 font-semibold">
                              +${over65Service?.base_price || 25}
                            </span>
                          )}
                        </div>
                        <p className="text-gray-600 text-xs">
                          Additional charge for larger TVs (+${over65Service?.base_price || 25})
                        </p>
                      </div>
                    </label>
                  </div>

                  {/* Frame Mount Add-on */}
                  <div className="bg-white rounded-lg p-3 border">
                    <label className="flex items-center space-x-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config.frameMount}
                        onChange={(e) => updateTvConfiguration(config.id, { frameMount: e.target.checked })}
                        className="w-4 h-4 text-blue-600 bg-white border-gray-300 rounded focus:ring-blue-500"
                      />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-gray-900">Frame Mount Add-on</span>
                          {config.frameMount && (
                            <span className="text-green-600 font-semibold">
                              +${frameMountService?.base_price || 25}
                            </span>
                          )}
                        </div>
                        <p className="text-gray-600 text-xs">
                          Specialized frame mounting service (+${frameMountService?.base_price || 25})
                        </p>
                      </div>
                    </label>
                  </div>

                  {/* Steel/Brick/Concrete Wall Add-on */}
                  <div className="bg-white rounded-lg p-3 border">
                    <label className="flex items-center space-x-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config.wallType !== 'standard'}
                        onChange={(e) => updateTvConfiguration(config.id, { wallType: e.target.checked ? 'steel' : 'standard' })}
                        className="w-4 h-4 text-blue-600 bg-white border-gray-300 rounded focus:ring-blue-500"
                      />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-gray-900">Steel/Brick/Concrete Wall</span>
                          {config.wallType !== 'standard' && (
                            <span className="text-green-600 font-semibold">
                              +${stoneWallService?.base_price || 40}
                            </span>
                          )}
                        </div>
                        <p className="text-gray-600 text-xs">
                          Additional charge for specialty wall surfaces (+${stoneWallService?.base_price || 40})
                        </p>
                      </div>
                    </label>
                  </div>

                  {/* Mount Soundbar Add-on */}
                  <div className="bg-white rounded-lg p-3 border">
                    <label className="flex items-center space-x-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config.soundbar}
                        onChange={(e) => updateTvConfiguration(config.id, { soundbar: e.target.checked })}
                        className="w-4 h-4 text-blue-600 bg-white border-gray-300 rounded focus:ring-blue-500"
                      />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-gray-900">Mount Soundbar</span>
                          {config.soundbar && (
                            <span className="text-green-600 font-semibold">
                              +$40
                            </span>
                          )}
                        </div>
                        <p className="text-gray-600 text-xs">
                          Professional soundbar mounting service (+$40)
                        </p>
                      </div>
                    </label>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Services Summary */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-200">
            <h3 className="text-lg font-semibold text-blue-900 mb-3">Selected Services:</h3>
            <div className="space-y-2">
              {buildServicesList().map((service, index) => (
                <div key={index} className="flex justify-between items-center text-sm">
                  <span className="text-blue-800">{service.name}</span>
                  <span className="text-blue-600 font-semibold">${service.price}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Price Summary */}
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-4 border border-green-200">
            <div className="flex justify-between items-center text-gray-900">
              <span className="text-lg font-semibold">Total Price:</span>
              <span className="text-2xl font-bold text-green-600">${totalPrice}</span>
            </div>
            <div className="text-xs text-gray-600 mt-2">
              Price updates automatically based on your selections
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-4 pt-4">
            <Button
              onClick={onClose}
              variant="outline"
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleComplete}
              className="flex-1 bg-blue-600 hover:bg-blue-700"
            >
              <Check className="h-4 w-4 mr-2" />
              Apply Configuration
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
