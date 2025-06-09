
import React, { useState, useEffect } from 'react';
import { X, Plus, Minus } from 'lucide-react';
import { CartItem } from '@/pages/Index';

interface TvMountingModalProps {
  onClose: () => void;
  onSubmit: (item: CartItem) => void;
}

export const TvMountingModal: React.FC<TvMountingModalProps> = ({ onClose, onSubmit }) => {
  const [extraTvs, setExtraTvs] = useState(0);
  const [stoneWork, setStoneWork] = useState(false);

  const basePrice = 100; // Base price includes 1 TV
  const stoneWorkPrice = 50;

  const calculateExtraTvPrice = (count: number) => {
    if (count === 1) return 90;
    if (count === 2) return 75;
    if (count >= 3) return 60;
    return 0;
  };

  const calculateTotalPrice = () => {
    let total = basePrice;
    
    // Add extra TV costs
    for (let i = 1; i <= extraTvs; i++) {
      total += calculateExtraTvPrice(i);
    }
    
    // Add stone work if selected
    if (stoneWork) total += stoneWorkPrice;
    
    return total;
  };

  const handleSubmit = () => {
    onSubmit({
      id: 'tv-mounting',
      name: 'TV Mounting Service',
      price: calculateTotalPrice(),
      quantity: 1,
      options: {
        extraTvs,
        stoneWork
      }
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-2xl font-bold text-gray-900">TV Mounting Service</h3>
            <button 
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 p-2 rounded-full hover:bg-gray-100"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          
          <div className="space-y-6">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="text-sm text-blue-600 font-medium mb-1">Base Service Includes:</div>
              <div className="text-gray-700">1 TV Mounting - $100</div>
            </div>
            
            <div>
              <label className="block text-gray-700 font-medium mb-3">Additional TVs</label>
              <div className="flex items-center justify-between bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center space-x-4">
                  <button
                    onClick={() => setExtraTvs(Math.max(0, extraTvs - 1))}
                    className="bg-white hover:bg-gray-100 border border-gray-300 text-gray-700 p-2 rounded-full"
                    disabled={extraTvs === 0}
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="text-lg font-semibold w-8 text-center">{extraTvs}</span>
                  <button
                    onClick={() => setExtraTvs(extraTvs + 1)}
                    className="bg-white hover:bg-gray-100 border border-gray-300 text-gray-700 p-2 rounded-full"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                {extraTvs > 0 && (
                  <div className="text-right">
                    <div className="text-sm text-gray-600">
                      ${calculateExtraTvPrice(extraTvs)} each
                    </div>
                    <div className="font-semibold text-blue-600">
                      +${Array.from({length: extraTvs}, (_, i) => calculateExtraTvPrice(i + 1)).reduce((a, b) => a + b, 0)}
                    </div>
                  </div>
                )}
              </div>
              {extraTvs > 0 && (
                <div className="mt-2 text-sm text-gray-600">
                  Pricing: 1st extra TV $90, 2nd $75, 3rd+ $60 each
                </div>
              )}
            </div>
            
            <div>
              <label className="block text-gray-700 font-medium mb-3">Surface Type</label>
              <select
                value={stoneWork ? 'stone' : 'standard'}
                onChange={(e) => setStoneWork(e.target.value === 'stone')}
                className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="standard">Standard Wall (Drywall)</option>
                <option value="stone">Stone/Brick/Tile (+$50)</option>
              </select>
            </div>
            
            <div className="bg-gray-900 text-white rounded-lg p-4">
              <div className="flex justify-between items-center">
                <span className="text-lg font-semibold">Total Price:</span>
                <span className="text-2xl font-bold">${calculateTotalPrice()}</span>
              </div>
              <div className="text-sm text-gray-300 mt-1">
                {1 + extraTvs} TV{1 + extraTvs > 1 ? 's' : ''} total
              </div>
            </div>
            
            <button
              onClick={handleSubmit}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200"
            >
              Book Service
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
