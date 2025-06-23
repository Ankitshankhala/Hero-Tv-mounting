
import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Minus } from 'lucide-react';

interface ServiceBaseCardProps {
  serviceName: string;
  basePrice: number;
  quantity: number;
  onQuantityChange: (newQuantity: number) => void;
}

export const ServiceBaseCard = ({ 
  serviceName, 
  basePrice, 
  quantity, 
  onQuantityChange 
}: ServiceBaseCardProps) => {
  return (
    <Card className="border-2 border-blue-200 bg-blue-50">
      <CardContent className="p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
          <div className="flex-1">
            <h3 className="font-bold text-lg text-gray-900 mb-2">{serviceName}</h3>
            <p className="text-gray-600 mb-3">Professional {serviceName.toLowerCase()} service</p>
            <Badge variant="secondary" className="bg-blue-100 text-blue-800">
              Base Service
            </Badge>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 bg-white rounded-lg p-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onQuantityChange(Math.max(1, quantity - 1))}
                disabled={quantity <= 1}
                className="h-8 w-8 p-0"
              >
                <Minus className="h-4 w-4" />
              </Button>
              <span className="w-8 text-center font-medium">{quantity}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onQuantityChange(quantity + 1)}
                className="h-8 w-8 p-0"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="text-right">
              <div className="font-bold text-2xl text-blue-600">${basePrice * quantity}</div>
              <div className="text-sm text-gray-500">${basePrice} each</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
