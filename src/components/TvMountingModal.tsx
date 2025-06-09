
import React, { useState } from 'react';
import { X, Plus, Minus } from 'lucide-react';
import { CartItem } from '@/pages/Index';

interface TvMountingModalProps {
  onClose: () => void;
  onAddToCart: (item: CartItem) => void;
}

export const TvMountingModal: React.FC<TvMountingModalProps> = ({ onClose, onAddToCart }) => {
  const [over65, setOver65] = useState(false);
  const [frameMount, setFrameMount] = useState(false);
  const [numberOfTvs, setNumberOfTvs] = useState(1); // Start with 1 TV already included
  const [wallType, setWallType] = useState('standard');

  const basePrice = 90; // Includes 1 TV
  const over65Price = 25;
  const frameMountPrice = 25;
  const stoneBrickTilePrice = 50;

  const calculateTvPrice = () => {
    if (numberOfTvs === 1) return basePrice; // Base price includes 1 TV
    
    let totalTvPrice = basePrice; // First TV is included in base price
    
    // Calculate additional TVs pricing
    const additionalTvs = numberOfTvs - 1;
    
    if (additionalTvs >= 1 && additionalTvs <= 1) {
      // +1 TV = $90
      totalTvPrice += 90;
    } else if (additionalTvs === 2) {
      // +2 TVs = $75 each
      totalTvPrice += 90; // First additional TV
      totalTvPrice += 75; // Second additional TV
    } else if (additionalTvs >= 3) {
      // +3+ TVs = $60 each
      totalTvPrice += 90; // First additional TV
      totalTvPrice += 75; // Second additional TV
      totalTvPrice += (additionalTvs - 2) * 60; // Remaining TVs at $60 each
    }
    
    return totalTvPrice;
  };

  const calculatePrice = () => {
    let total = calculateTvPrice();
    if (over65) total += over65Price;
    if (frameMount) total += frameMountPrice;
    if (wallType === 'stone-brick-tile') total += stoneBrickTilePrice;
    return total;
  };

  const handleAddToCart = () => {
    onAddToCart({
      id: 'tv-mounting',
      name: 'TV Mounting',
      price: calculatePrice(),
      quantity: 1,
      options: {
        over65,
        frameMount,
        numberOfTvs,
        cableConcealment: 'none',
        wallType
      }
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto border border-slate-700">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-2xl font-bold text-white">TV Mounting Options</h3>
            <button 
              onClick={onClose}
              className="text-slate-400 hover:text-white p-2 rounded-full hover:bg-slate-800"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          
          <div className="space-y-6">
            <div>
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={over65}
                  onChange={(e) => setOver65(e.target.checked)}
                  className="w-5 h-5 text-blue-600 bg-slate-800 border-slate-600 rounded focus:ring-blue-500 focus:ring-2"
                />
                <span className="text-white flex-1">Over 65" TV</span>
                <span className="text-blue-400 font-semibold">+${over65Price}</span>
              </label>
            </div>
            
            <div>
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={frameMount}
                  onChange={(e) => setFrameMount(e.target.checked)}
                  className="w-5 h-5 text-blue-600 bg-slate-800 border-slate-600 rounded focus:ring-blue-500 focus:ring-2"
                />
                <span className="text-white flex-1">Frame Mount</span>
                <span className="text-blue-400 font-semibold">+${frameMountPrice}</span>
              </label>
            </div>
            
            <div>
              <label className="block text-white mb-3">Number of TVs (1st TV included)</label>
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => setNumberOfTvs(Math.max(1, numberOfTvs - 1))}
                  className="bg-slate-800 hover:bg-slate-700 text-white p-2 rounded-full"
                  disabled={numberOfTvs === 1}
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="text-white font-semibold w-8 text-center">{numberOfTvs}</span>
                <button
                  onClick={() => setNumberOfTvs(Math.min(10, numberOfTvs + 1))}
                  className="bg-slate-800 hover:bg-slate-700 text-white p-2 rounded-full"
                  disabled={numberOfTvs === 10}
                >
                  <Plus className="h-4 w-4" />
                </button>
                <span className="text-blue-400 font-semibold">
                  {numberOfTvs === 1 ? 'Included' : `+$${calculateTvPrice() - basePrice}`}
                </span>
              </div>
              {numberOfTvs > 1 && (
                <div className="text-sm text-slate-400 mt-2">
                  Pricing: +1 TV = $90, +2 TVs = $75 each, +3+ TVs = $60 each
                </div>
              )}
            </div>

            <div>
              <label className="block text-white mb-3">Wall Type</label>
              <select
                value={wallType}
                onChange={(e) => setWallType(e.target.value)}
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="standard">Standard Wall</option>
                <option value="stone-brick-tile">Stone, Brick, Tile (+$50)</option>
              </select>
            </div>
            
            <div className="bg-slate-800 rounded-lg p-4">
              <div className="flex justify-between items-center text-lg font-bold text-white">
                <span>Total Price:</span>
                <span className="text-blue-400">${calculatePrice()}</span>
              </div>
            </div>
            
            <button
              onClick={handleAddToCart}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200"
            >
              Add to Cart
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
