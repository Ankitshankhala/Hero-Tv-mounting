import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Minus, Trash2, Settings } from 'lucide-react';

interface BookingService {
  id: string;
  service_id: string;
  service_name: string;
  base_price: number;
  quantity: number;
  configuration: any;
}

interface ServiceConfigurationTabProps {
  services: BookingService[];
  onUpdateQuantity: (serviceId: string, newQuantity: number) => void;
  onUpdateConfiguration: (serviceId: string, configuration: any) => void;
  onRemoveService: (serviceId: string) => void;
  onTvMountingConfiguration: (serviceId: string) => void;
  calculateServicePrice: (service: BookingService) => number;
}

export const ServiceConfigurationTab: React.FC<ServiceConfigurationTabProps> = ({
  services,
  onUpdateQuantity,
  onUpdateConfiguration,
  onRemoveService,
  onTvMountingConfiguration,
  calculateServicePrice
}) => {
  const renderServiceConfiguration = (service: BookingService) => {
    const config = service.configuration || {};
    const configItems = [];

    if (service.service_name === 'TV Mounting') {
      if (config.over65) configItems.push('Over 65" TV (+$50)');
      if (config.frameMount) configItems.push('Frame Mount (+$75)');
      if (config.wallType && config.wallType !== 'standard') {
        configItems.push(`${config.wallType} Wall (+$100)`);
      }
      if (config.soundbar) configItems.push('Soundbar Mounting (+$30)');
    }

    return configItems;
  };

  if (services.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="text-slate-400 mb-4">No services configured for this booking</div>
        <div className="text-sm text-slate-500">Add services using the "Add New Services" tab</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-white mb-4">Current Services</h3>
      
      {services.map((service) => {
        const servicePrice = calculateServicePrice(service);
        const configItems = renderServiceConfiguration(service);
        
        return (
          <Card key={service.id} className="bg-slate-700 border-slate-600">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-white text-lg">{service.service_name}</CardTitle>
                <div className="flex items-center space-x-2">
                  {service.service_name === 'TV Mounting' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onTvMountingConfiguration(service.id)}
                      className="border-slate-500 text-white hover:bg-slate-600"
                    >
                      <Settings className="h-4 w-4 mr-1" />
                      Configure
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onRemoveService(service.id)}
                    className="border-red-500 text-red-400 hover:bg-red-900/20"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-4">
              {/* Configuration Options */}
              {configItems.length > 0 && (
                <div className="space-y-2">
                  <div className="text-sm text-slate-300">Configuration:</div>
                  <div className="flex flex-wrap gap-2">
                    {configItems.map((item, index) => (
                      <Badge key={index} variant="secondary" className="bg-slate-600 text-white">
                        {item}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Quantity Controls */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <span className="text-slate-300">Quantity:</span>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onUpdateQuantity(service.id, service.quantity - 1)}
                      disabled={service.quantity <= 1}
                      className="h-8 w-8 p-0 border-slate-500 text-white hover:bg-slate-600"
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <span className="w-8 text-center text-white font-medium">
                      {service.quantity}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onUpdateQuantity(service.id, service.quantity + 1)}
                      className="h-8 w-8 p-0 border-slate-500 text-white hover:bg-slate-600"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                
                <div className="text-right">
                  <div className="text-sm text-slate-400">
                    ${servicePrice.toFixed(2)} each
                  </div>
                  <div className="text-lg font-semibold text-white">
                    ${(servicePrice * service.quantity).toFixed(2)}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};