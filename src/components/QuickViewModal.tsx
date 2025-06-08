
import React, { useState } from 'react';
import { X, Plus, Minus } from 'lucide-react';
import { CartItem } from '@/pages/Index';

interface Service {
  id: string;
  name: string;
  price: number;
  image: string;
  description: string;
  category: string;
  popular?: boolean;
}

interface QuickViewModalProps {
  service: Service | null;
  onClose: () => void;
  onAddToCart: (item: CartItem) => void;
}

export const QuickViewModal: React.FC<QuickViewModalProps> = ({ 
  service, 
  onClose, 
  onAddToCart 
}) => {
  const [quantity, setQuantity] = useState(1);

  if (!service) return null;

  const handleAddToCart = () => {
    onAddToCart({
      id: service.id,
      name: service.name,
      price: service.price,
      quantity
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end md:items-center justify-center">
      <div className="bg-slate-900 w-full md:max-w-lg md:rounded-xl overflow-hidden border-t md:border border-slate-700">
        <div className="relative">
          <img 
            src={service.image} 
            alt={service.name}
            className="w-full h-48 object-cover"
          />
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 bg-black/50 text-white p-2 rounded-full hover:bg-black/70"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <div className="p-6">
          <div className="flex items-start gap-2 mb-4">
            <h2 className="text-2xl font-bold text-white flex-1">{service.name}</h2>
            {service.popular && (
              <span className="bg-orange-500 text-white text-xs px-2 py-1 rounded">Popular</span>
            )}
          </div>
          
          <p className="text-slate-300 mb-6">{service.description}</p>
          
          <div className="flex items-center justify-between mb-6">
            <span className="text-2xl font-bold text-white">${service.price}</span>
            
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="bg-slate-800 hover:bg-slate-700 text-white p-2 rounded-full"
                disabled={quantity === 1}
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="text-white font-semibold w-8 text-center">{quantity}</span>
              <button
                onClick={() => setQuantity(quantity + 1)}
                className="bg-slate-800 hover:bg-slate-700 text-white p-2 rounded-full"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>
          
          <button
            onClick={handleAddToCart}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition-colors"
          >
            Add {quantity} to cart • ${(service.price * quantity).toFixed(0)}
          </button>
        </div>
      </div>
    </div>
  );
};
