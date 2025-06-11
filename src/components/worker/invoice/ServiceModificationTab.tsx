
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Minus, Plus, Trash2 } from 'lucide-react';

interface Service {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

interface ServiceModificationTabProps {
  services: Service[];
  onUpdateQuantity: (serviceId: string, newQuantity: number) => void;
  onRemoveService: (serviceId: string) => void;
}

export const ServiceModificationTab: React.FC<ServiceModificationTabProps> = ({
  services,
  onUpdateQuantity,
  onRemoveService
}) => {
  return (
    <div>
      <Label className="text-white">Current Services</Label>
      <div className="space-y-3 mt-2">
        {services.map((service) => (
          <Card key={service.id} className="bg-slate-700 border-slate-600">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h4 className="text-white font-medium">{service.name}</h4>
                  <p className="text-slate-400">${service.price} each</p>
                </div>
                
                <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onUpdateQuantity(service.id, service.quantity - 1)}
                      disabled={service.quantity <= 0}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <Input
                      type="number"
                      value={service.quantity}
                      onChange={(e) => onUpdateQuantity(service.id, parseInt(e.target.value) || 0)}
                      className="w-16 text-center bg-slate-600 border-slate-500"
                      min="0"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onUpdateQuantity(service.id, service.quantity + 1)}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => onRemoveService(service.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              <div className="mt-2 text-right">
                <span className="text-white font-semibold">
                  Subtotal: ${(service.price * service.quantity).toFixed(2)}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
