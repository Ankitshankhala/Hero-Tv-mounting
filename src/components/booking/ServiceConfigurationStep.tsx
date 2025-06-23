
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
        <h3 className="text-2xl font-bold text-gray-900 mb-2">Configure Your Services</h3>
        <p className="text-gray-600">Customize quantities and options for your selected services</p>
      </div>

      <div className="space-y-4">
        {services.map((service) => (
          <Card key={service.id} className="border-2 border-gray-200 hover:border-blue-300 transition-all duration-200 hover:shadow-md">
            <CardContent className="p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
                <div className="flex-1">
                  <h4 className="font-semibold text-lg text-gray-900">{service.name}</h4>
                  <p className="text-gray-600">${service.price} each</p>
                </div>
                
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2 bg-gray-50 rounded-lg p-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => updateServiceQuantity(service.id, -1)}
                      disabled={service.quantity <= 1}
                      className="h-8 w-8 p-0 hover:bg-red-50 hover:border-red-200"
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <span className="w-8 text-center font-medium bg-white px-2 py-1 rounded">{service.quantity}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => updateServiceQuantity(service.id, 1)}
                      className="h-8 w-8 p-0 hover:bg-green-50 hover:border-green-200"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  <div className="text-right">
                    <div className="font-bold text-lg text-green-600">
                      ${service.price * service.quantity}
                    </div>
                  </div>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => removeService(service.id)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
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
        <div className="text-center py-12 text-gray-500">
          <Star className="h-12 w-12 mx-auto text-gray-300 mb-4" />
          <p>No services selected. Please select services from the homepage.</p>
        </div>
      )}

      <div className="border-t pt-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-4">
        <div className="flex justify-between items-center text-2xl font-bold">
          <span className="text-gray-900">Total:</span>
          <span className="text-green-600">${getTotalPrice()}</span>
        </div>
      </div>
    </div>
  );
};
