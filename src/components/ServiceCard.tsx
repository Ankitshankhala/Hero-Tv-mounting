
import React, { useState } from 'react';
import { Plus, Check, TestTube } from 'lucide-react';
import { useTestingMode, getEffectiveServicePrice } from '@/contexts/TestingModeContext';

interface ServiceCardProps {
  id: string;
  name: string;
  price: number;
  image: string;
  description: string;
  onAddToCart: () => void;
}

export const ServiceCard: React.FC<ServiceCardProps> = ({ id, name, price, image, description, onAddToCart }) => {
  const [isClicked, setIsClicked] = useState(false);
  const { isTestingMode } = useTestingMode();
  
  const effectivePrice = getEffectiveServicePrice(price, isTestingMode);
  const cardBorderClass = isTestingMode 
    ? 'border-orange-500 bg-orange-900/20' 
    : 'border-slate-700 hover:border-blue-500';

  const handleClick = () => {
    setIsClicked(true);
    onAddToCart();
    setTimeout(() => setIsClicked(false), 1000);
  };

  return (
    <div 
      className={`bg-slate-900/80 backdrop-blur-sm rounded-xl overflow-hidden border ${cardBorderClass} transition-all duration-300 cursor-pointer group hover:scale-105 hover:shadow-xl`}
      onClick={handleClick}
    >
      <div className="relative h-48 overflow-hidden">
        <img 
          src={image} 
          alt={name}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 to-transparent" />
      </div>
      
      <div className="p-6">
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-xl font-bold text-white">{name}</h3>
            {isTestingMode && (
              <div className="flex items-center gap-1 px-2 py-1 bg-orange-600 rounded text-xs text-white">
                <TestTube className="h-3 w-3" />
                <span>$1 Testing</span>
              </div>
            )}
          </div>
          <p className="text-slate-300 text-sm">{description}</p>
        </div>
        
        <div className="flex items-center justify-between">
          <div className="text-2xl font-bold text-white transition-all duration-300">
            {name === 'TV Mounting' ? (isTestingMode ? '$1' : 'Starting at $90') : `$${effectivePrice}`}
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
