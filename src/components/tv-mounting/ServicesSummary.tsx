
import React from 'react';

interface Service {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

interface ServicesSummaryProps {
  services: Service[];
  totalPrice: number;
}

export const ServicesSummary: React.FC<ServicesSummaryProps> = ({
  services,
  totalPrice
}) => {
  return (
    <>
      {/* Services Summary */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-700 rounded-lg p-4 border border-slate-600">
        <h3 className="text-lg font-semibold text-white mb-3">Selected Services:</h3>
        <div className="space-y-2">
          {services.map((service, index) => (
            <div key={index} className="flex justify-between items-center text-sm">
              <span className="text-slate-300">{service.name}</span>
              <span className="text-blue-400 font-semibold">${service.price}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Price Summary */}
      <div className="bg-gradient-to-r from-blue-900/50 to-purple-900/50 rounded-lg p-4 border border-blue-500/30">
        <div className="flex justify-between items-center text-white">
          <span className="text-lg font-semibold">Total Price:</span>
          <span className="text-2xl font-bold text-blue-400">${totalPrice}</span>
        </div>
        <div className="text-xs text-slate-400 mt-2">
          Price updates automatically based on your selections
        </div>
      </div>
    </>
  );
};
