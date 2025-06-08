
import React from 'react';
import { Plus } from 'lucide-react';

interface ServiceCardProps {
  service: {
    id: string;
    name: string;
    price: number;
    image: string;
    description: string;
  };
  onClick: () => void;
}

export const ServiceCard: React.FC<ServiceCardProps> = ({ service, onClick }) => {
  return (
    <div 
      className="bg-slate-900/80 backdrop-blur-sm rounded-xl overflow-hidden border border-slate-700 hover:border-blue-500 transition-all duration-300 cursor-pointer group hover:scale-105"
      onClick={onClick}
    >
      <div className="relative h-48 overflow-hidden">
        <img 
          src={service.image} 
          alt={service.name}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 to-transparent" />
        <div className="absolute bottom-4 left-4 right-4">
          <h3 className="text-xl font-bold text-white mb-1">{service.name}</h3>
          <p className="text-slate-300 text-sm">{service.description}</p>
        </div>
      </div>
      
      <div className="p-6">
        <div className="flex items-center justify-between">
          <div className="text-2xl font-bold text-white">
            ${service.price}
          </div>
          <button className="bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-full transition-colors duration-200 group-hover:scale-110">
            <Plus className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
};
