
import React, { useState } from 'react';
import { X, Monitor, ArrowRight } from 'lucide-react';
import { CartItem } from '@/pages/Index';
import { Service } from '@/hooks/useServicesData';

interface TvMountingModalProps {
  onClose: () => void;
  onAddToCart: (item: CartItem) => void;
  services: Service[];
}

export const TvMountingModal: React.FC<TvMountingModalProps> = ({ onClose, onAddToCart, services }) => {
  const [over65, setOver65] = useState(false);
  const [frameMount, setFrameMount] = useState(false);
  const [numberOfTvs, setNumberOfTvs] = useState(1);
  const [cableConcealment, setCableConcealment] = useState('none');
  const [wallType, setWallType] = useState('standard');

  // Find services from database
  const tvMountingService = services.find(s => s.name === 'TV Mounting');
  const over65Service = services.find(s => s.name === 'Over 65" TV Add-on');
  const frameMountService = services.find(s => s.name === 'Frame Mount Add-on');
  const stoneWallService = services.find(s => s.name === 'Stone/Brick/Tile Wall');
  const simpleConcealmentService = services.find(s => s.name === 'Simple Cable Concealment');
  const fireSafeConcealmentService = services.find(s => s.name === 'Fire Safe Cable Concealment');

  const calculatePrice = () => {
    let basePrice = tvMountingService?.base_price || 90;
    let totalPrice = basePrice * numberOfTvs;

    if (over65 && over65Service) {
      totalPrice += over65Service.base_price * numberOfTvs;
    }
    
    if (frameMount && frameMountService) {
      totalPrice += frameMountService.base_price * numberOfTvs;
    }
    
    if (wallType === 'stone-brick-tile' && stoneWallService) {
      totalPrice += stoneWallService.base_price * numberOfTvs;
    }
    
    if (cableConcealment === 'simple' && simpleConcealmentService) {
      totalPrice += simpleConcealmentService.base_price;
    } else if (cableConcealment === 'fire-safe' && fireSafeConcealmentService) {
      totalPrice += fireSafeConcealmentService.base_price;
    }

    return totalPrice;
  };

  const handleAddToCart = () => {
    const cartItem: CartItem = {
      id: 'tv-mounting-configured',
      name: `TV Mounting${numberOfTvs > 1 ? ` (${numberOfTvs} TVs)` : ''}`,
      price: calculatePrice(),
      quantity: 1,
      options: {
        over65,
        frameMount,
        numberOfTvs,
        cableConcealment,
        wallType
      }
    };

    onAddToCart(cartItem);
    onClose();
  };

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
          {/* Number of TVs */}
          <div className="bg-slate-800 rounded-lg p-4">
            <label className="block text-lg font-semibold text-white mb-3">
              Number of TVs
            </label>
            <div className="flex space-x-3">
              {[1, 2, 3, 4].map((num) => (
                <button
                  key={num}
                  onClick={() => setNumberOfTvs(num)}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${
                    numberOfTvs === num
                      ? 'bg-blue-600 text-white shadow-lg'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  {num} TV{num > 1 ? 's' : ''}
                </button>
              ))}
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
              <div>
                <span className="text-lg font-semibold text-white">Over 65" TV</span>
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
              <div>
                <span className="text-lg font-semibold text-white">Frame Mount</span>
                <p className="text-slate-400 text-sm">
                  Specialized frame mounting service (+${frameMountService?.base_price || 25} per TV)
                </p>
              </div>
            </label>
          </div>

          {/* Wall Type */}
          <div className="bg-slate-800 rounded-lg p-4">
            <label className="block text-lg font-semibold text-white mb-3">
              Wall Type
            </label>
            <div className="space-y-2">
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="radio"
                  name="wallType"
                  value="standard"
                  checked={wallType === 'standard'}
                  onChange={(e) => setWallType(e.target.value)}
                  className="w-4 h-4 text-blue-600 bg-slate-700 border-slate-600 focus:ring-blue-500"
                />
                <span className="text-white">Standard Drywall (No extra charge)</span>
              </label>
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="radio"
                  name="wallType"
                  value="stone-brick-tile"
                  checked={wallType === 'stone-brick-tile'}
                  onChange={(e) => setWallType(e.target.value)}
                  className="w-4 h-4 text-blue-600 bg-slate-700 border-slate-600 focus:ring-blue-500"
                />
                <span className="text-white">
                  Stone/Brick/Tile Wall (+${stoneWallService?.base_price || 50} total)
                </span>
              </label>
            </div>
          </div>

          {/* Cable Concealment */}
          <div className="bg-slate-800 rounded-lg p-4">
            <label className="block text-lg font-semibold text-white mb-3">
              Cable Concealment
            </label>
            <div className="space-y-2">
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="radio"
                  name="cableConcealment"
                  value="none"
                  checked={cableConcealment === 'none'}
                  onChange={(e) => setCableConcealment(e.target.value)}
                  className="w-4 h-4 text-blue-600 bg-slate-700 border-slate-600 focus:ring-blue-500"
                />
                <span className="text-white">No cable concealment</span>
              </label>
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="radio"
                  name="cableConcealment"
                  value="simple"
                  checked={cableConcealment === 'simple'}
                  onChange={(e) => setCableConcealment(e.target.value)}
                  className="w-4 h-4 text-blue-600 bg-slate-700 border-slate-600 focus:ring-blue-500"
                />
                <span className="text-white">
                  Simple Cable Concealment (+${simpleConcealmentService?.base_price || 50})
                </span>
              </label>
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="radio"
                  name="cableConcealment"
                  value="fire-safe"
                  checked={cableConcealment === 'fire-safe'}
                  onChange={(e) => setCableConcealment(e.target.value)}
                  className="w-4 h-4 text-blue-600 bg-slate-700 border-slate-600 focus:ring-blue-500"
                />
                <span className="text-white">
                  Fire Safe Cable Concealment (+${fireSafeConcealmentService?.base_price || 100})
                </span>
              </label>
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
