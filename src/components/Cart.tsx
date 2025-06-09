
import React from 'react';
import { ShoppingCart, X } from 'lucide-react';
import { CartItem } from '@/pages/Index';

interface CartProps {
  items: CartItem[];
  total: number;
  onCheckout: () => void;
  onRemoveItem: (id: string) => void;
}

export const Cart: React.FC<CartProps> = ({ items, total, onCheckout, onRemoveItem }) => {
  return (
    <div className="fixed bottom-4 right-4 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl max-w-sm w-full mx-4 z-40">
      <div className="p-4">
        <div className="flex items-center space-x-3 mb-4">
          <ShoppingCart className="h-5 w-5 text-blue-400" />
          <h3 className="text-lg font-semibold text-white">Cart ({items.length})</h3>
        </div>
        
        <div className="space-y-3 max-h-40 overflow-y-auto">
          {items.map((item) => (
            <div key={item.id} className="flex items-center justify-between bg-slate-800 rounded-lg p-3">
              <div className="flex-1">
                <div className="text-white font-medium">{item.name}</div>
                <div className="text-sm text-slate-400">
                  ${item.price} x {item.quantity}
                </div>
                {item.options && (
                  <div className="text-xs text-slate-500">
                    {item.options.over65 && 'Over 65", '}
                    {item.options.frameMount && 'Frame Mount, '}
                    {item.options.extraTvs > 0 && `+${item.options.extraTvs} TVs, `}
                    {item.options.cableConcealment !== 'none' && item.options.cableConcealment}
                  </div>
                )}
              </div>
              <button
                onClick={() => onRemoveItem(item.id)}
                className="text-slate-400 hover:text-red-400 p-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
        
        <div className="mt-4 pt-4 border-t border-slate-700">
          <div className="flex justify-between items-center mb-4">
            <span className="text-lg font-semibold text-white">Total:</span>
            <span className="text-xl font-bold text-blue-400">${total}</span>
          </div>
          <button
            onClick={onCheckout}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition-colors duration-200"
          >
            Checkout
          </button>
        </div>
      </div>
    </div>
  );
};
