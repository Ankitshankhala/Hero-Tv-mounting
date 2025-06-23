
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

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
  const [tvConfigs, setTvConfigs] = useState([
    { mountType: 'TV Mounting', tvSize: '32-49', basePrice: 90, quantity: 0 },
    { mountType: 'TV Mounting', tvSize: '50-59', basePrice: 90, quantity: 0 },
    { mountType: 'TV Mounting', tvSize: '60-69', basePrice: 115, quantity: 0 },
    { mountType: 'TV Mounting', tvSize: '70-79', basePrice: 115, quantity: 0 },
    { mountType: 'TV Mounting', tvSize: '80+', basePrice: 115, quantity: 0 },
  ]);

  const [cableConcealment, setCableConcealment] = useState({
    type: 'none',
    quantity: 0,
  });

  const [additionalServices, setAdditionalServices] = useState([
    { name: 'Full Motion Mount', basePrice: 25, quantity: 0 },
    { name: 'Flat Mount', basePrice: 0, quantity: 0 },
  ]);

  const handleTvConfigChange = (index: number, quantity: number) => {
    const newConfigs = [...tvConfigs];
    newConfigs[index] = { ...newConfigs[index], quantity };
    setTvConfigs(newConfigs);
  };

  const handleCableConcealmentChange = (type: string) => {
    setCableConcealment({ type, quantity: type === 'none' ? 0 : 1 });
  };

  const handleAdditionalServiceChange = (index: number, quantity: number) => {
    const newServices = [...additionalServices];
    newServices[index] = { ...newServices[index], quantity };
    setAdditionalServices(newServices);
  };

  const getCableConcealmentPrice = (type: string) => {
    const priceMap: { [key: string]: number } = {
      'Simple Cable Concealment': 30,
      'Fire Safe Cable Concealment': 50,
    };
    return priceMap[type] || 0;
  };

  const getTotalPrice = () => {
    let total = 0;
    
    // Calculate TV mounting prices
    tvConfigs.forEach((config) => {
      total += config.basePrice * config.quantity;
    });

    // Calculate cable concealment price
    if (cableConcealment.type !== 'none') {
      total += getCableConcealmentPrice(cableConcealment.type);
    }

    // Calculate additional services
    additionalServices.forEach((service) => {
      total += service.basePrice * service.quantity;
    });

    return total;
  };

  const getTotalItems = () => {
    let total = 0;
    tvConfigs.forEach((config) => {
      total += config.quantity;
    });
    total += cableConcealment.quantity;
    additionalServices.forEach((service) => {
      total += service.quantity;
    });
    return total;
  };

  const handleAddToCart = () => {
    const cartItems = [];
    
    // Add base TV mounting services
    tvConfigs.forEach((config) => {
      if (config.quantity > 0) {
        cartItems.push({
          id: `tv-mounting-${config.tvSize}-${Date.now()}-${Math.random()}`,
          name: `${config.mountType} - ${config.tvSize}"`,
          price: config.basePrice,
          quantity: config.quantity
        });
      }
    });

    // Add cable concealment if selected
    if (cableConcealment.type !== 'none' && cableConcealment.quantity > 0) {
      cartItems.push({
        id: `cable-concealment-${Date.now()}`,
        name: cableConcealment.type,
        price: getCableConcealmentPrice(cableConcealment.type),
        quantity: cableConcealment.quantity
      });
    }

    // Add additional services
    additionalServices.forEach((service) => {
      if (service.quantity > 0) {
        cartItems.push({
          id: `additional-${service.name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`,
          name: service.name,
          price: service.basePrice,
          quantity: service.quantity
        });
      }
    });

    onAddToCart(cartItems);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0">
        <DialogHeader className="p-6">
          <DialogTitle>Configure TV Mounting</DialogTitle>
        </DialogHeader>

        <div className="p-6">
          <h3 className="text-xl font-semibold mb-4">TV Mounting Services</h3>
          {tvConfigs.map((config, index) => (
            <Card key={index} className="mb-4">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor={`tv-${index}`} className="block text-sm font-medium text-gray-700">
                      {config.mountType} - {config.tvSize}" (${config.basePrice})
                    </Label>
                  </div>
                  <Input
                    type="number"
                    id={`tv-${index}`}
                    className="w-24"
                    min="0"
                    value={config.quantity}
                    onChange={(e) => handleTvConfigChange(index, parseInt(e.target.value) || 0)}
                  />
                </div>
              </CardContent>
            </Card>
          ))}

          <h3 className="text-xl font-semibold mt-6 mb-4">Cable Concealment</h3>
          <Card className="mb-4">
            <CardContent className="p-4">
              <div className="space-y-2">
                <div>
                  <Label htmlFor="cable-none" className="inline-flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      id="cable-none"
                      name="cable-concealment"
                      checked={cableConcealment.type === 'none'}
                      onChange={() => handleCableConcealmentChange('none')}
                      className="focus:ring-0"
                    />
                    <span>None</span>
                  </Label>
                </div>
                <div>
                  <Label htmlFor="cable-simple" className="inline-flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      id="cable-simple"
                      name="cable-concealment"
                      checked={cableConcealment.type === 'Simple Cable Concealment'}
                      onChange={() => handleCableConcealmentChange('Simple Cable Concealment')}
                      className="focus:ring-0"
                    />
                    <span>Simple Cable Concealment ($30)</span>
                  </Label>
                </div>
                <div>
                  <Label htmlFor="cable-fire-safe" className="inline-flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      id="cable-fire-safe"
                      name="cable-concealment"
                      checked={cableConcealment.type === 'Fire Safe Cable Concealment'}
                      onChange={() => handleCableConcealmentChange('Fire Safe Cable Concealment')}
                      className="focus:ring-0"
                    />
                    <span>Fire Safe Cable Concealment ($50)</span>
                  </Label>
                </div>
              </div>
            </CardContent>
          </Card>

          <h3 className="text-xl font-semibold mt-6 mb-4">Additional Services</h3>
          {additionalServices.map((service, index) => (
            <Card key={index} className="mb-4">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor={`additional-${index}`} className="block text-sm font-medium text-gray-700">
                      {service.name} {service.basePrice > 0 && `(+$${service.basePrice})`}
                    </Label>
                  </div>
                  <Input
                    type="number"
                    id={`additional-${index}`}
                    className="w-24"
                    min="0"
                    value={service.quantity}
                    onChange={(e) => handleAdditionalServiceChange(index, parseInt(e.target.value) || 0)}
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        
        <div className="p-6 border-t">
          <div className="flex flex-col sm:flex-row justify-between items-center space-y-4 sm:space-y-0">
            <div className="text-center sm:text-left">
              <div className="text-2xl font-bold text-green-600">${getTotalPrice()}</div>
              <div className="text-sm text-gray-600">Total for {getTotalItems()} items</div>
            </div>
            
            <div className="flex space-x-3 w-full sm:w-auto">
              <Button variant="outline" onClick={onClose} className="flex-1 sm:flex-none">
                Cancel
              </Button>
              <Button 
                onClick={handleAddToCart}
                disabled={getTotalItems() === 0}
                className="flex-1 sm:flex-none bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
              >
                Continue to Booking
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
