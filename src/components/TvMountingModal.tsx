
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
  const [extraTvs, setExtraTvs] = useState(0);
  const [cableConcealment, setCableConcealment] = useState('none');

  const basePrice = 100;
  const over65Price = 25;
  const frameMountPrice = 25;
  const extraTvPrice = 65;

  const calculatePrice = () => {
    let total = basePrice;
    if (over65) total += over65Price;
    if (frameMount) total += frameMountPrice;
    total += extraTvs * extraTvPrice;
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
        extraTvs,
        cableConcealment
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
              <label className="block text-white mb-3">Extra TVs (max 3)</label>
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => setExtraTvs(Math.max(0, extraTvs - 1))}
                  className="bg-slate-800 hover:bg-slate-700 text-white p-2 rounded-full"
                  disabled={extraTvs === 0}
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="text-white font-semibold w-8 text-center">{extraTvs}</span>
                <button
                  onClick={() => setExtraTvs(Math.min(3, extraTvs + 1))}
                  className="bg-slate-800 hover:bg-slate-700 text-white p-2 rounded-full"
                  disabled={extraTvs === 3}
                >
                  <Plus className="h-4 w-4" />
                </button>
                <span className="text-blue-400 font-semibold">+${extraTvs * extraTvPrice}</span>
              </div>
            </div>
            
            <div>
              <label className="block text-white mb-3">Cable Concealment Type</label>
              <select
                value={cableConcealment}
                onChange={(e) => setCableConcealment(e.target.value)}
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="none">No Concealment</option>
                <option value="surface">Surface Mount</option>
                <option value="in-wall">In-Wall</option>
                <option value="fire-safe">Fire Safe</option>
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
