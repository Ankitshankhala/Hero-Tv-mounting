
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-slate-800 border-slate-700 text-white">
        <DialogHeader className="flex flex-row items-center justify-between pb-4 border-b border-slate-700">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center">
              <span className="text-white font-bold">📺</span>
            </div>
            <div>
              <DialogTitle className="text-xl font-bold text-white">TV Mounting Configuration</DialogTitle>
              <p className="text-slate-400 text-sm">Customize your TV mounting service for each TV</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </DialogHeader>

        <div className="space-y-6 py-6">
          {/* Number of TVs */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white">Number of TVs</h3>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setNumberOfTvs(Math.max(1, numberOfTvs - 1))}
                disabled={numberOfTvs <= 1}
                className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
                  numberOfTvs <= 1
                    ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                    : 'bg-slate-700 text-white hover:bg-slate-600'
                }`}
              >
                <Minus className="h-4 w-4" />
              </button>
              <div className="w-16 h-10 bg-slate-700 rounded-lg flex items-center justify-center">
                <span className="text-xl font-semibold text-white">{numberOfTvs}</span>
              </div>
              <button
                onClick={() => setNumberOfTvs(Math.min(5, numberOfTvs + 1))}
                disabled={numberOfTvs >= 5}
                className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
                  numberOfTvs >= 5
                    ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                    : 'bg-slate-700 text-white hover:bg-slate-600'
                }`}
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <p className="text-slate-400 text-sm">Base TV Mounting: $90</p>
          </div>

          {/* Configure Each TV */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white">Configure Each TV</h3>
            {tvConfigurations.map((config, index) => (
              <Card key={config.id} className="bg-slate-700 border-slate-600">
                <CardContent className="p-4">
                  <h4 className="font-semibold text-white mb-4">TV #{index + 1} Configuration</h4>
                  
                  <div className="space-y-3">
                    {/* Over 65" TV Add-on */}
                    <label className="flex items-center space-x-3 p-3 bg-slate-800 rounded-lg cursor-pointer hover:bg-slate-750 transition-colors">
                      <input
                        type="checkbox"
                        checked={config.over65}
                        onChange={(e) => updateTvConfiguration(config.id, { over65: e.target.checked })}
                        className="w-5 h-5 text-blue-600 bg-slate-700 border-slate-600 rounded focus:ring-blue-500"
                      />
                      <div className="flex-1">
                        <div className="font-medium text-white">Over 65" TV Add-on</div>
                        <div className="text-sm text-slate-400">
                          Additional charge for larger TVs (+${over65Service?.base_price || 25})
                        </div>
                      </div>
                    </label>

                    {/* Frame Mount Add-on */}
                    <label className="flex items-center space-x-3 p-3 bg-slate-800 rounded-lg cursor-pointer hover:bg-slate-750 transition-colors">
                      <input
                        type="checkbox"
                        checked={config.frameMount}
                        onChange={(e) => updateTvConfiguration(config.id, { frameMount: e.target.checked })}
                        className="w-5 h-5 text-blue-600 bg-slate-700 border-slate-600 rounded focus:ring-blue-500"
                      />
                      <div className="flex-1">
                        <div className="font-medium text-white">Frame Mount Add-on</div>
                        <div className="text-sm text-slate-400">
                          Specialized frame mounting service (+${frameMountService?.base_price || 25})
                        </div>
                      </div>
                    </label>

                    {/* Wall Type */}
                    <div className="p-3 bg-slate-800 rounded-lg">
                      <label className="block text-sm font-medium text-white mb-2">Wall Type</label>
                      <select
                        value={config.wallType}
                        onChange={(e) => updateTvConfiguration(config.id, { wallType: e.target.value })}
                        className="w-full p-2 bg-slate-700 border border-slate-600 rounded text-white focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="standard">Standard Wall</option>
                        <option value="stone">Stone/Brick/Tile Wall (+$50)</option>
                      </select>
                    </div>

                    {/* Soundbar */}
                    <label className="flex items-center space-x-3 p-3 bg-slate-800 rounded-lg cursor-pointer hover:bg-slate-750 transition-colors">
                      <input
                        type="checkbox"
                        checked={config.soundbar}
                        onChange={(e) => updateTvConfiguration(config.id, { soundbar: e.target.checked })}
                        className="w-5 h-5 text-blue-600 bg-slate-700 border-slate-600 rounded focus:ring-blue-500"
                      />
                      <div className="flex-1">
                        <div className="font-medium text-white">Mount Soundbar</div>
                        <div className="text-sm text-slate-400">
                          Additional soundbar mounting (+$40)
                        </div>
                      </div>
                    </label>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
        
        <div className="border-t border-slate-700 pt-4">
          <div className="flex justify-between items-center">
            <div className="text-2xl font-bold text-green-400">${totalPrice}</div>
            
            <div className="flex space-x-3">
              <Button 
                variant="outline" 
                onClick={onClose}
                className="border-slate-600 text-slate-300 hover:bg-slate-700"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleAddToCart}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                Add to Cart
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
