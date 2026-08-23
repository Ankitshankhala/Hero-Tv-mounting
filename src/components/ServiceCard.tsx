
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

  const priceLabel =
    name === 'TV Mounting' || name === 'Mount TV'
      ? isTestingMode
        ? '$1'
        : 'From $90'
      : `$${effectivePrice}`;

  return (
    <div
      className={`bg-slate-900/80 backdrop-blur-sm rounded-xl overflow-hidden border ${cardBorderClass} transition-all duration-300 cursor-pointer group hover:shadow-xl md:hover:scale-[1.02] flex flex-col`}
      onClick={handleClick}
    >
      <div className="relative w-full overflow-hidden aspect-[4/3]">
        <img
          src={image}
          alt={name}
          className="w-full h-full object-cover md:group-hover:scale-105 transition-transform duration-300"
          width="400"
          height="300"
          loading="lazy"
          decoding="async"
          style={{ aspectRatio: '4/3' }}
        />
        {isTestingMode && (
          <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 bg-orange-600 rounded text-[10px] text-white">
            <TestTube className="h-3 w-3" />
            <span>$1</span>
          </div>
        )}
      </div>

      {/* Mobile compact body */}
      <div className="p-3 md:p-6 flex-1 flex flex-col">
        <h3 className="text-sm md:text-xl font-semibold md:font-bold text-white line-clamp-2 min-h-[2.5rem] md:min-h-0">
          {name}
        </h3>
        {description?.trim() && (
          <p className="text-slate-300 text-xs md:text-sm mt-1 md:mt-2 line-clamp-2 md:line-clamp-none">
            {description}
          </p>
        )}

        <div className="mt-2 md:mt-4 flex items-center justify-between gap-2">
          <div className="text-base md:text-2xl font-bold text-white truncate">
            {priceLabel}
          </div>
          <button
            className={`shrink-0 rounded-full transition-all duration-300 flex items-center justify-center h-11 w-11 md:h-12 md:w-12 ${
              isClicked
                ? 'bg-green-600 text-white animate-pulse'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
            aria-label={isClicked ? `${name} added to cart` : `Add ${name} to cart`}
          >
            {isClicked ? <Check className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
          </button>
        </div>
      </div>
    </div>
  );
};
