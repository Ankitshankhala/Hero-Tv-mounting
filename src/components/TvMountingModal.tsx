
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X, Plus, Minus } from 'lucide-react';
import { useTvMountingModal } from '@/hooks/useTvMountingModal';

interface TvMountingModalProps {
  open: boolean;
  onClose: () => void;
  onAddToCart: (items: Array<{
    id: string;
    name: string;
    price: number;
    quantity: number;
  }>) => void;
  services: any[];
}

export const TvMountingModal = ({ open, onClose, onAddToCart, services }: TvMountingModalProps) => {
  const {
    numberOfTvs,
    setNumberOfTvs,
    tvConfigurations,
    updateTvConfiguration,
    totalPrice,
    buildServicesList,
    over65Service,
    frameMountService
  } = useTvMountingModal(services);

  const handleAddToCart = () => {
    const servicesList = buildServicesList();
    onAddToCart(servicesList);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-slate-800 border-slate-700 text-white p-0">
        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b border-slate-700 flex flex-row items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-6 h-6 bg-blue-500 rounded flex items-center justify-center">
              <span className="text-white text-sm">📺</span>
            </div>
            <DialogTitle className="text-lg font-semibold text-white">TV Mounting Configuration</DialogTitle>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </DialogHeader>

        <div className="px-6 py-4 space-y-6">
          <p className="text-sm text-slate-400">Customize your TV mounting service for each TV</p>

          {/* Number of TVs */}
          <div>
            <h3 className="text-white font-medium mb-3">Number of TVs</h3>
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setNumberOfTvs(Math.max(1, numberOfTvs - 1))}
                disabled={numberOfTvs <= 1}
                className={`w-8 h-8 rounded border flex items-center justify-center transition-colors ${
                  numberOfTvs <= 1
                    ? 'border-slate-600 text-slate-500 cursor-not-allowed'
                    : 'border-slate-500 text-white hover:border-slate-400'
                }`}
              >
                <Minus className="h-4 w-4" />
              </button>
              <div className="w-12 text-center">
                <span className="text-xl font-semibold text-white">{numberOfTvs}</span>
              </div>
              <button
                onClick={() => setNumberOfTvs(Math.min(5, numberOfTvs + 1))}
                disabled={numberOfTvs >= 5}
                className={`w-8 h-8 rounded border flex items-center justify-center transition-colors ${
                  numberOfTvs >= 5
                    ? 'border-slate-600 text-slate-500 cursor-not-allowed'
                    : 'border-slate-500 text-white hover:border-slate-400'
                }`}
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <p className="text-sm text-slate-400 mt-2">Base TV Mounting: $90</p>
          </div>

          {/* Configure Each TV */}
          <div>
            <h3 className="text-white font-medium mb-3">Configure Each TV</h3>
            <div className="bg-slate-700 rounded-lg p-4 space-y-3">
              <h4 className="text-sm font-medium text-slate-300 mb-3">TV #1 Configuration</h4>
              
              {/* Over 65" TV Add-on */}
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={tvConfigurations[0]?.over65 || false}
                  onChange={(e) => updateTvConfiguration('1', { over65: e.target.checked })}
                  className="w-4 h-4 text-blue-600 bg-slate-600 border-slate-500 rounded focus:ring-blue-500"
                />
                <div className="flex-1">
                  <div className="text-white text-sm">Over 65" TV Add-on</div>
                  <div className="text-xs text-slate-400">Additional charge for larger TVs (+$25)</div>
                </div>
              </label>

              {/* Frame Mount Add-on */}
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={tvConfigurations[0]?.frameMount || false}
                  onChange={(e) => updateTvConfiguration('1', { frameMount: e.target.checked })}
                  className="w-4 h-4 text-blue-600 bg-slate-600 border-slate-500 rounded focus:ring-blue-500"
                />
                <div className="flex-1">
                  <div className="text-white text-sm">Frame Mount Add-on</div>
                  <div className="text-xs text-slate-400">Specialized frame mounting service (+$25)</div>
                </div>
              </label>

              {/* Stone/Brick/Tile Wall */}
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={tvConfigurations[0]?.wallType !== 'standard'}
                  onChange={(e) => updateTvConfiguration('1', { wallType: e.target.checked ? 'stone' : 'standard' })}
                  className="w-4 h-4 text-blue-600 bg-slate-600 border-slate-500 rounded focus:ring-blue-500"
                />
                <div className="flex-1">
                  <div className="text-white text-sm">Stone/Brick/Tile Wall</div>
                  <div className="text-xs text-slate-400">Additional charge for specialty wall surfaces (+$50)</div>
                </div>
              </label>

              {/* Mount Soundbar */}
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={tvConfigurations[0]?.soundbar || false}
                  onChange={(e) => updateTvConfiguration('1', { soundbar: e.target.checked })}
                  className="w-4 h-4 text-blue-600 bg-slate-600 border-slate-500 rounded focus:ring-blue-500"
                />
                <div className="flex-1">
                  <div className="text-white text-sm">Mount Soundbar</div>
                  <div className="text-xs text-slate-400">Additional soundbar mounting service (+$45)</div>
                </div>
              </label>
            </div>
          </div>

          {/* Selected Services */}
          <div>
            <h3 className="text-white font-medium mb-3">Selected Services:</h3>
            <div className="bg-slate-700 rounded-lg p-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-300">TV Mounting</span>
                <span className="text-sm text-blue-400">$90</span>
              </div>
            </div>
          </div>

          {/* Total Price */}
          <div className="bg-gradient-to-r from-purple-900/50 to-blue-900/50 rounded-lg p-4">
            <div className="flex justify-between items-center">
              <span className="text-white font-medium">Total Price:</span>
              <span className="text-2xl font-bold text-blue-400">${totalPrice}</span>
            </div>
            <p className="text-xs text-slate-400 mt-1">Price updates automatically based on your selections</p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 flex space-x-3">
          <Button 
            variant="outline" 
            onClick={onClose}
            className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-700"
          >
            Cancel
          </Button>
          <Button 
            onClick={handleAddToCart}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
          >
            Add to Cart • ${totalPrice}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
