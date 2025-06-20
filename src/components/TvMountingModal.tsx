import React, { useState } from 'react';
import { X, Monitor, ArrowRight, Plus, Minus, Check } from 'lucide-react';
import { CartItem } from '@/types';
import { PublicService } from '@/hooks/usePublicServicesData';

interface TvMountingModalProps {
  open: boolean;
  onClose: () => void;
  onAddToCart: (item: CartItem) => void;
  services: PublicService[];
}

export const TvMountingModal: React.FC<TvMountingModalProps> = ({ open, onClose, onAddToCart, services }) => {
  const [over65, setOver65] = useState(false);
  const [frameMount, setFrameMount] = useState(false);
  const [numberOfTvs, setNumberOfTvs] = useState(1);
  const [wallType, setWallType] = useState('standard');

  if (!open) {
    return null;
  }

  // Find services from database
  const tvMountingService = services.find(s => s.name === 'TV Mounting');
  const over65Service = services.find(s => s.name === 'Over 65" TV Add-on');
  const frameMountService = services.find(s => s.name === 'Frame Mount Add-on');
  const stoneWallService = services.find(s => s.name === 'Stone/Brick/Tile Wall');

  const calculateTvMountingPrice = (numTvs: number) => {
    let totalPrice = 0;
    
    for (let i = 1; i <= numTvs; i++) {
      if (i === 1) {
        totalPrice += 90; // First TV: $90
      } else if (i === 2) {
        totalPrice += 60; // Second TV: $60
      } else {
        totalPrice += 75; // Third TV and beyond: $75 each
      }
    }
    
    return totalPrice;
  };

  const calculatePrice = () => {
    let totalPrice = calculateTvMountingPrice(numberOfTvs);

    if (over65 && over65Service) {
      totalPrice += over65Service.base_price * numberOfTvs;
    }
    
    if (frameMount && frameMountService) {
      totalPrice += frameMountService.base_price * numberOfTvs;
    }
    
    if (wallType !== 'standard' && stoneWallService) {
      totalPrice += stoneWallService.base_price * numberOfTvs;
    }

    return totalPrice;
  };

  const buildCartItemName = () => {
    let name = `TV Mounting${numberOfTvs > 1 ? ` (${numberOfTvs} TVs)` : ''}`;
    const addOns = [];
    
    if (over65) addOns.push('Over 65" TV');
    if (frameMount) addOns.push('Frame Mount');
    if (wallType !== 'standard') addOns.push(`${wallType.charAt(0).toUpperCase() + wallType.slice(1)} Wall`);
    
    if (addOns.length > 0) {
      name += ` + ${addOns.join(' + ')}`;
    }
    
    return name;
  };

  const buildServicesList = () => {
    const selectedServices = [];
    
    // Base TV Mounting service
    selectedServices.push({
      id: 'tv-mounting-base',
      name: `TV Mounting${numberOfTvs > 1 ? ` (${numberOfTvs} TVs)` : ''}`,
      price: calculateTvMountingPrice(numberOfTvs),
      quantity: 1
    });

    // Add-on services
    if (over65 && over65Service) {
      selectedServices.push({
        id: over65Service.id,
        name: `Over 65" TV Add-on${numberOfTvs > 1 ? ` (${numberOfTvs} TVs)` : ''}`,
        price: over65Service.base_price * numberOfTvs,
        quantity: 1
      });
    }
    
    if (frameMount && frameMountService) {
      selectedServices.push({
        id: frameMountService.id,
        name: `Frame Mount Add-on${numberOfTvs > 1 ? ` (${numberOfTvs} TVs)` : ''}`,
        price: frameMountService.base_price * numberOfTvs,
        quantity: 1
      });
    }
    
    if (wallType !== 'standard' && stoneWallService) {
      selectedServices.push({
        id: stoneWallService.id,
        name: `${wallType.charAt(0).toUpperCase() + wallType.slice(1)} Wall Service${numberOfTvs > 1 ? ` (${numberOfTvs} TVs)` : ''}`,
        price: stoneWallService.base_price * numberOfTvs,
        quantity: 1
      });
    }

    return selectedServices;
  };

  const handleAddToCart = () => {
    const cartItem: CartItem = {
      id: 'tv-mounting-configured',
      name: buildCartItemName(),
      price: calculatePrice(),
      quantity: 1,
      options: {
        over65,
        frameMount,
        numberOfTvs,
        wallType,
        services: buildServicesList()
      }
    };

    onAddToCart(cartItem);
    onClose();
  };

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

  const wallTypeOptions = [
    { value: 'standard', label: 'Standard Drywall' },
    { value: 'stone', label: 'Stone' },
    { value: 'brick', label: 'Brick' },
    { value: 'tile', label: 'Tile' }
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-slate-700 flex justify-between items-center sticky top-0 bg-slate-900 z-10">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center">
              <Monitor className="mr-3 h-6 w-6 text-blue-400" />
              TV Mounting Configuration
            </h2>
            <p className="text-slate-400 mt-1">Customize your TV mounting service</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors p-2 hover:bg-slate-800 rounded-lg"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Number of TVs with + and - buttons */}
          <div className="bg-slate-800 rounded-lg p-4">
            <label className="block text-lg font-semibold text-white mb-3">
              Number of TVs
            </label>
            <div className="flex items-center space-x-4">
              <button
                onClick={decrementTvs}
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
                onClick={incrementTvs}
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
            {/* TV pricing breakdown */}
            <div className="mt-3 text-sm text-slate-400">
              <div>Base TV Mounting: ${calculateTvMountingPrice(numberOfTvs)}</div>
              {numberOfTvs > 1 && (
                <div className="text-xs mt-1">
                  1st TV: $90, 2nd TV: $60{numberOfTvs > 2 && `, Additional TVs: $75 each`}
                </div>
              )}
            </div>
          </div>

          {/* TV Size */}
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
                      +${(over65Service?.base_price || 25) * numberOfTvs}
                    </span>
                  )}
                </div>
                <p className="text-slate-400 text-sm">
                  Additional charge for larger TVs (+${over65Service?.base_price || 25} per TV)
                </p>
              </div>
            </label>
          </div>

          {/* Frame Mount */}
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

          {/* Wall Type - Tick-select UI */}
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
                          +${stoneWallService?.base_price || 50} per TV
                        </p>
                        {wallType === option.value && (
                          <p className="text-green-400 font-semibold">
                            Total: +${(stoneWallService?.base_price || 50) * numberOfTvs}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Services Summary */}
          <div className="bg-gradient-to-r from-slate-800 to-slate-700 rounded-lg p-4 border border-slate-600">
            <h3 className="text-lg font-semibold text-white mb-3">Selected Services:</h3>
            <div className="space-y-2">
              {buildServicesList().map((service, index) => (
                <div key={index} className="flex justify-between items-center text-sm">
                  <span className="text-slate-300">{service.name}</span>
                  <span className="text-blue-400 font-semibold">${service.price}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Price Summary */}
          <div className="bg-gradient-to-r from-blue-900/50 to-purple-900/50 rounded-lg p-4 border border-blue-500/30">
            <div className="flex justify-between items-center text-white">
              <span className="text-lg font-semibold">Total Price:</span>
              <span className="text-2xl font-bold text-blue-400">${calculatePrice()}</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-4 pt-4">
            <button
              onClick={onClose}
              className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-semibold py-3 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleAddToCart}
              className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold py-3 rounded-lg transition-all flex items-center justify-center space-x-2"
            >
              <span>Add to Cart</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
