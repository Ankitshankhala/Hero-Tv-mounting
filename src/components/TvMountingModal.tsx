
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
    buildServicesList
  } = useTvMountingModal(services);

  const handleAddToCart = () => {
    const servicesList = buildServicesList();
    onAddToCart(servicesList);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configure TV Mounting</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 p-6">
          {/* Number of TVs */}
          <div>
            <Label htmlFor="number-of-tvs" className="text-lg font-semibold mb-4 block">
              Number of TVs to Mount
            </Label>
            <Input
              id="number-of-tvs"
              type="number"
              min="1"
              max="5"
              value={numberOfTvs}
              onChange={(e) => setNumberOfTvs(parseInt(e.target.value) || 1)}
              className="w-32"
            />
          </div>

          {/* TV Configurations */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">TV Configuration</h3>
            {tvConfigurations.map((config, index) => (
              <Card key={config.id} className="p-4">
                <CardContent className="space-y-4">
                  <h4 className="font-medium">TV {index + 1}</h4>
                  
                  {/* TV Size */}
                  <div className="flex items-center space-x-4">
                    <Label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={config.over65}
                        onChange={(e) => updateTvConfiguration(config.id, { over65: e.target.checked })}
                      />
                      <span>Over 65" TV (+$25)</span>
                    </Label>
                  </div>

                  {/* Frame Mount */}
                  <div className="flex items-center space-x-4">
                    <Label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={config.frameMount}
                        onChange={(e) => updateTvConfiguration(config.id, { frameMount: e.target.checked })}
                      />
                      <span>Frame Mount (+$25)</span>
                    </Label>
                  </div>

                  {/* Wall Type */}
                  <div>
                    <Label className="block mb-2">Wall Type</Label>
                    <select
                      value={config.wallType}
                      onChange={(e) => updateTvConfiguration(config.id, { wallType: e.target.value })}
                      className="w-full p-2 border rounded"
                    >
                      <option value="standard">Standard Wall</option>
                      <option value="stone">Stone/Brick/Tile Wall (+$50)</option>
                    </select>
                  </div>

                  {/* Soundbar */}
                  <div className="flex items-center space-x-4">
                    <Label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={config.soundbar}
                        onChange={(e) => updateTvConfiguration(config.id, { soundbar: e.target.checked })}
                      />
                      <span>Mount Soundbar (+$40)</span>
                    </Label>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
        
        <div className="p-6 border-t">
          <div className="flex justify-between items-center">
            <div className="text-2xl font-bold text-green-600">${totalPrice}</div>
            
            <div className="flex space-x-3">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button 
                onClick={handleAddToCart}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
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
