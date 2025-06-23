
import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Star, Plus, Minus } from 'lucide-react';

interface ServiceItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  options?: Record<string, any>;
}

interface ServiceConfigurationStepProps {
  services: ServiceItem[];
  updateServiceQuantity: (serviceId: string, change: number) => void;
  removeService: (serviceId: string) => void;
  getTotalPrice: () => number;
}

export const ServiceConfigurationStep = ({
  services,
  updateServiceQuantity,
  removeService,
  getTotalPrice
}: ServiceConfigurationStepProps) => {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-2xl font-bold text-white mb-2">Configure Your Services</h3>
        <p className="text-slate-300">Customize quantities and options for your selected services</p>
      </div>

      <div className="space-y-4">
        {services.map((service) => (
          <Card key={service.id} className="border-2 border-slate-600/50 hover:border-blue-400/50 transition-all duration-200 hover:shadow-lg bg-slate-800/50 backdrop-blur-sm">
            <CardContent className="p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
                <div className="flex-1">
                  <h4 className="font-semibold text-lg text-white">{service.name}</h4>
                  <p className="text-slate-300">${service.price} each</p>
                </div>
                
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2 bg-slate-700/50 rounded-lg p-2 border border-slate-600/50">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => updateServiceQuantity(service.id, -1)}
                      disabled={service.quantity <= 1}
                      className="h-8 w-8 p-0 hover:bg-red-500/20 hover:border-red-400/50 bg-slate-700 border-slate-600 text-white"
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <span className="w-8 text-center font-medium bg-slate-600 text-white px-2 py-1 rounded border border-slate-500">{service.quantity}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => updateServiceQuantity(service.id, 1)}
                      className="h-8 w-8 p-0 hover:bg-green-500/20 hover:border-green-400/50 bg-slate-700 border-slate-600 text-white"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  <div className="text-right">
                    <div className="font-bold text-lg text-green-400">
                      ${service.price * service.quantity}
                    </div>
                  </div>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => removeService(service.id)}
                    className="text-red-400 hover:text-red-300 hover:bg-red-500/20 border-red-500/50 bg-slate-700/50"
                  >
                    Remove
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {services.length === 0 && (
        <div className="text-center py-12 text-slate-400">
          <Star className="h-12 w-12 mx-auto text-slate-500 mb-4" />
          <p>No services selected. Please select services from the homepage.</p>
        </div>
      )}

      <div className="border-t border-slate-600/50 pt-4 bg-gradient-to-r from-green-900/30 to-emerald-900/30 rounded-xl p-4 backdrop-blur-sm border border-green-500/20">
        <div className="flex justify-between items-center text-2xl font-bold">
          <span className="text-white">Total:</span>
          <span className="text-green-400">${getTotalPrice()}</span>
        </div>
      </div>
    </div>
  );
};
