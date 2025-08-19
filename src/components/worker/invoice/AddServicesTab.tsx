
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Plus } from 'lucide-react';
import { usePublicServicesData } from '@/hooks/usePublicServicesData';
import { useTestingMode, getEffectiveServicePrice } from '@/contexts/TestingModeContext';

interface AddServicesTabProps {
  onAddService: (service: any) => void;
}

export const AddServicesTab: React.FC<AddServicesTabProps> = ({
  onAddService
}) => {
  const { services, loading } = usePublicServicesData();
  const [quantities, setQuantities] = useState<{ [key: string]: number }>({});
  const { isTestingMode } = useTestingMode();

  useEffect(() => {
    // Initialize quantities for all services
    const initialQuantities: { [key: string]: number } = {};
    services.forEach(service => {
      initialQuantities[service.id] = 1;
    });
    setQuantities(initialQuantities);
  }, [services]);

  const handleQuantityChange = (serviceId: string, quantity: number) => {
    if (quantity < 1) return;
    setQuantities(prev => ({
      ...prev,
      [serviceId]: quantity
    }));
  };

  const handleAddService = (service: any) => {
    const quantity = quantities[service.id] || 1;
    const effectivePrice = getEffectiveServicePrice(service.base_price, isTestingMode);
    const serviceToAdd = {
      id: service.id,
      name: service.name,
      price: effectivePrice,
      quantity: quantity
    };
    
    onAddService(serviceToAdd);
    
    // Reset quantity back to 1 after adding
    setQuantities(prev => ({
      ...prev,
      [service.id]: 1
    }));
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="text-white">Loading services...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-white text-lg font-semibold">Available Services</Label>
        {isTestingMode && (
          <Badge variant="secondary" className="bg-yellow-600 text-yellow-100">
            TEST MODE: $1 pricing active
          </Badge>
        )}
      </div>
      <div className="grid gap-4">
        {services.map((service) => (
          <Card key={service.id} className="bg-slate-700 border-slate-600">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-base">{service.name}</CardTitle>
              {service.description && (
                <p className="text-slate-400 text-sm">{service.description}</p>
              )}
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-2">
                    <Label className="text-slate-300 text-sm">Qty:</Label>
                    <Input
                      type="number"
                      value={quantities[service.id] || 1}
                      onChange={(e) => handleQuantityChange(service.id, parseInt(e.target.value) || 1)}
                      className="w-16 text-center bg-slate-600 border-slate-500 text-white"
                      min="1"
                    />
                  </div>
                  <div className="text-slate-300">
                    <span className="text-sm">Price: </span>
                    <span className="font-semibold">${getEffectiveServicePrice(service.base_price, isTestingMode)}</span>
                    {quantities[service.id] > 1 && (
                      <span className="text-xs text-slate-400 ml-1">
                        (Total: ${(getEffectiveServicePrice(service.base_price, isTestingMode) * quantities[service.id]).toFixed(2)})
                      </span>
                    )}
                  </div>
                </div>
                
                <Button
                  onClick={() => handleAddService(service)}
                  className="bg-blue-600 hover:bg-blue-700"
                  size="sm"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
