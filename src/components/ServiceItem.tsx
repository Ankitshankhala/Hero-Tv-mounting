
import React from 'react';
import { Plus } from 'lucide-react';

interface Service {
  id: string;
  name: string;
  price: number;
  image: string;
  description: string;
  category: string;
  popular?: boolean;
}

interface ServiceItemProps {
  service: Service;
  onClick: () => void;
}

export const ServiceItem: React.FC<ServiceItemProps> = ({ service, onClick }) => {
  return (
    <div 
      className="flex gap-4 p-4 hover:bg-slate-800/50 rounded-lg cursor-pointer transition-colors border-b border-slate-700/50 last:border-b-0"
      onClick={onClick}
    >
      <div className="flex-1">
        <div className="flex items-start gap-2 mb-2">
          <h3 className="text-lg font-semibold text-white">{service.name}</h3>
          {service.popular && (
            <span className="bg-orange-500 text-white text-xs px-2 py-1 rounded">Popular</span>
          )}
        </div>
        
        <p className="text-slate-400 text-sm mb-3 line-clamp-2">{service.description}</p>
        
        <div className="flex items-center justify-between">
          <span className="text-lg font-bold text-white">${service.price}</span>
          <button 
            className="bg-slate-700 hover:bg-blue-600 text-white p-2 rounded-full transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              onClick();
            }}
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>
      
      <div className="w-20 h-20 rounded-lg overflow-hidden flex-shrink-0">
        <img 
          src={service.image} 
          alt={service.name}
          className="w-full h-full object-cover"
        />
      </div>
    </div>
  );
};
