
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface ServiceOption {
  id: string;
  name: string;
  price: number;
  description: string;
  category: string;
}

interface ServiceOptionCardProps {
  option: ServiceOption;
  isSelected: boolean;
  quantity: number;
  onToggle: (option: ServiceOption) => void;
}

export const ServiceOptionCard = ({ 
  option, 
  isSelected, 
  quantity, 
  onToggle 
}: ServiceOptionCardProps) => {
  return (
    <Card
      className={cn(
        "cursor-pointer transition-all duration-200 hover:shadow-md",
        isSelected 
          ? "border-2 border-green-500 bg-green-50" 
          : "border border-gray-200 hover:border-gray-300"
      )}
      onClick={() => onToggle(option)}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center space-x-2 mb-1">
              <h5 className="font-medium text-gray-900">{option.name}</h5>
              {isSelected && (
                <Badge variant="default" className="bg-green-600">
                  Selected
                </Badge>
              )}
            </div>
            <p className="text-sm text-gray-600">{option.description}</p>
          </div>
          <div className="text-right ml-4">
            <div className="font-bold text-lg text-green-600">
              +${option.price * quantity}
            </div>
            <div className="text-xs text-gray-500">
              +${option.price} each
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
