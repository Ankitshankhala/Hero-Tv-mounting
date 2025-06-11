
import React, { useState } from 'react';
import { Plus, Check } from 'lucide-react';

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
  const [isClicked, setIsClicked] = useState(false);

  const handleClick = () => {
    setIsClicked(true);
    onClick();
    setTimeout(() => setIsClicked(false), 1000);
  };

  return (
    <div 
      className="bg-slate-900/80 backdrop-blur-sm rounded-xl overflow-hidden border border-slate-700 hover:border-blue-500 transition-all duration-300 cursor-pointer group hover:scale-105 hover:shadow-xl"
      onClick={handleClick}
    >
      <div className="relative h-48 overflow-hidden">
        <img 
          src={service.image} 
          alt={service.name}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 to-transparent" />
      </div>
      
      <div className="p-6">
        <div className="mb-4">
          <h3 className="text-xl font-bold text-white mb-2">{service.name}</h3>
          <p className="text-slate-300 text-sm">{service.description}</p>
        </div>
        
        <div className="flex items-center justify-between">
          <div className="text-2xl font-bold text-white transition-all duration-300">
            ${service.price}
          </div>
          <button className={`p-3 rounded-full transition-all duration-300 group-hover:scale-110 ${
            isClicked 
              ? 'bg-green-600 text-white animate-pulse' 
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}>
            {isClicked ? <Check className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
          </button>
        </div>
      </div>
    </div>
  );
};
