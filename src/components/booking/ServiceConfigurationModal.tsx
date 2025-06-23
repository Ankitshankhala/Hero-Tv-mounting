
import React, { useState } from 'react';
import { Wrench } from 'lucide-react';
import { ServiceModalHeader } from './modal/ServiceModalHeader';
import { ServiceBaseCard } from './modal/ServiceBaseCard';
import { ServiceOptionCard } from './modal/ServiceOptionCard';
import { ServiceModalFooter } from './modal/ServiceModalFooter';

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
        <ServiceModalHeader serviceName={serviceName} onClose={onClose} />

        <div className="p-4 sm:p-6 space-y-6">
          <ServiceBaseCard 
            serviceName={serviceName}
            basePrice={basePrice}
            quantity={quantity}
            onQuantityChange={setQuantity}
          />

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
                    {categoryOptions.map((option) => (
                      <ServiceOptionCard
                        key={option.id}
                        option={option}
                        isSelected={!!selectedOptions.find(opt => opt.id === option.id)}
                        quantity={quantity}
                        onToggle={toggleOption}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          <ServiceModalFooter
            serviceName={serviceName}
            quantity={quantity}
            selectedOptions={selectedOptions}
            totalPrice={getTotalPrice()}
            onCancel={onClose}
            onComplete={handleComplete}
          />
        </div>
      </div>
    </div>
  );
};
