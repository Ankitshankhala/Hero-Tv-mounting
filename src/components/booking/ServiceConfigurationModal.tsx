
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { X, Plus, Minus, Monitor, Wrench, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ServiceOption {
  id: string;
  name: string;
  price: number;
  description: string;
  category: string;
}

interface ServiceConfigurationModalProps {
  isOpen: boolean;
  onClose: () => void;
  serviceName: string;
  basePrice: number;
  options?: ServiceOption[];
  onConfigurationComplete: (configuration: {
    serviceName: string;
    basePrice: number;
    quantity: number;
    selectedOptions: ServiceOption[];
    totalPrice: number;
  }) => void;
}

export const ServiceConfigurationModal = ({
  isOpen,
  onClose,
  serviceName,
  basePrice,
  options = [],
  onConfigurationComplete
}: ServiceConfigurationModalProps) => {
  const [quantity, setQuantity] = useState(1);
  const [selectedOptions, setSelectedOptions] = useState<ServiceOption[]>([]);

  const toggleOption = (option: ServiceOption) => {
    setSelectedOptions(prev => {
      const exists = prev.find(opt => opt.id === option.id);
      if (exists) {
        return prev.filter(opt => opt.id !== option.id);
      } else {
        return [...prev, option];
      }
    });
  };

  const getTotalPrice = () => {
    const optionsTotal = selectedOptions.reduce((sum, option) => sum + option.price, 0);
    return (basePrice + optionsTotal) * quantity;
  };

  const handleComplete = () => {
    onConfigurationComplete({
      serviceName,
      basePrice,
      quantity,
      selectedOptions,
      totalPrice: getTotalPrice()
    });
  };

  const groupedOptions = options.reduce((groups, option) => {
    const category = option.category || 'General';
    if (!groups[category]) groups[category] = [];
    groups[category].push(option);
    return groups;
  }, {} as Record<string, ServiceOption[]>);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[95vh] overflow-y-auto">
        {/* Header */}
        <div className="relative bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 sm:px-6 py-4 sm:py-6 rounded-t-2xl">
          <button
            onClick={onClose}
            className="absolute top-3 right-3 sm:top-4 sm:right-4 p-2 hover:bg-white/20 rounded-lg transition-all duration-200"
          >
            <X className="h-5 w-5" />
          </button>
          
          <div className="flex items-center space-x-3">
            <div className="p-2 sm:p-3 bg-white/20 rounded-xl backdrop-blur-sm">
              <Monitor className="h-6 w-6 sm:h-7 sm:w-7" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold mb-1">Configure {serviceName}</h2>
              <p className="text-blue-100 text-sm">Customize your service options</p>
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-6 space-y-6">
          {/* Base Service */}
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
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      disabled={quantity <= 1}
                      className="h-8 w-8 p-0"
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <span className="w-8 text-center font-medium">{quantity}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setQuantity(quantity + 1)}
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

          {/* Service Options */}
          {Object.keys(groupedOptions).length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
                <Wrench className="h-5 w-5 text-gray-600" />
                <span>Additional Options</span>
              </h3>

              {Object.entries(groupedOptions).map(([category, categoryOptions]) => (
                <div key={category} className="space-y-3">
                  <h4 className="font-medium text-gray-800 border-b border-gray-200 pb-2">
                    {category}
                  </h4>
                  
                  <div className="grid grid-cols-1 gap-3">
                    {categoryOptions.map((option) => {
                      const isSelected = selectedOptions.find(opt => opt.id === option.id);
                      
                      return (
                        <Card
                          key={option.id}
                          className={cn(
                            "cursor-pointer transition-all duration-200 hover:shadow-md",
                            isSelected 
                              ? "border-2 border-green-500 bg-green-50" 
                              : "border border-gray-200 hover:border-gray-300"
                          )}
                          onClick={() => toggleOption(option)}
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
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Total and Action */}
          <div className="border-t pt-6 space-y-4">
            <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
              <CardContent className="p-4 sm:p-6">
                <div className="flex justify-between items-center">
                  <div>
                    <h4 className="font-bold text-lg text-gray-900">Total Price</h4>
                    <p className="text-sm text-gray-600">
                      {quantity} × {serviceName} {selectedOptions.length > 0 && `+ ${selectedOptions.length} options`}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-3xl text-green-600">${getTotalPrice()}</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3">
              <Button variant="outline" onClick={onClose} className="flex-1 sm:flex-none">
                Cancel
              </Button>
              <Button 
                onClick={handleComplete}
                className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
              >
                Add to Booking - ${getTotalPrice()}
              </Button>
            </div>
          </div>

          {/* Trust Indicators */}
          <div className="flex justify-center">
            <div className="flex items-center space-x-3 bg-gray-100 rounded-full px-4 py-2">
              <Shield className="h-4 w-4 text-green-600" />
              <span className="text-sm text-gray-700">Professional installation guaranteed</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
