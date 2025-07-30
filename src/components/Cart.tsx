
import React from 'react';
import { ShoppingCart, X, Calendar, AlertCircle, TestTube } from 'lucide-react';
import { CartItem } from '@/types';
import { useTestingMode, getEffectiveMinimumAmount } from '@/contexts/TestingModeContext';

interface CartProps {
  items: CartItem[];
  total: number;
  onRemoveItem: (id: string) => void;
  onBook: () => void;
  highlightedItemId?: string | null;
}

export const Cart: React.FC<CartProps> = ({ items, total, onRemoveItem, onBook, highlightedItemId }) => {
  const { isTestingMode } = useTestingMode();
  const MINIMUM_BOOKING_AMOUNT = getEffectiveMinimumAmount(isTestingMode);
  const isMinimumMet = total >= MINIMUM_BOOKING_AMOUNT;
  const amountNeeded = MINIMUM_BOOKING_AMOUNT - total;

  return (
    <div className="fixed bottom-4 right-4 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl max-w-sm w-full mx-4 z-40 animate-fade-in">
      <div className="p-4">
        <div className="flex items-center space-x-3 mb-4">
          <ShoppingCart className="h-5 w-5 text-blue-400" />
          <h3 className="text-lg font-semibold text-white">Cart ({items.length})</h3>
          {isTestingMode && (
            <div className="flex items-center space-x-1 bg-green-900/30 border border-green-500/50 px-2 py-1 rounded text-xs text-green-300">
              <TestTube className="h-3 w-3" />
              <span>Testing Mode</span>
            </div>
          )}
        </div>
        
        <div className="space-y-3 max-h-40 overflow-y-auto">
          {items.map((item) => (
            <div 
              key={item.id} 
              className={`flex items-center justify-between bg-slate-800 rounded-lg p-3 transition-all duration-500 ${
                highlightedItemId === item.id 
                  ? 'bg-blue-900/50 border border-blue-500/50 animate-pulse' 
                  : 'hover:bg-slate-700'
              }`}
            >
              <div className="flex-1">
                <div className="text-white font-medium">{item.name}</div>
                <div className="text-sm text-slate-400 transition-all duration-300">
                  ${item.price} x {item.quantity}
                </div>
                {item.options && (
                  <div className="text-xs text-slate-500">
                    {item.options.over65 && 'Over 65", '}
                    {item.options.frameMount && 'Frame Mount, '}
                    {item.options.numberOfTvs > 1 && `${item.options.numberOfTvs} TVs, `}
                    {item.options.wallType !== 'standard' && `${item.options.wallType} Wall`}
                  </div>
                )}
              </div>
              <button
                onClick={() => onRemoveItem(item.id)}
                className="text-slate-400 hover:text-red-400 p-1 transition-colors duration-200 hover:scale-110"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
        
        <div className="mt-4 pt-4 border-t border-slate-700">
          <div className="flex justify-between items-center mb-4">
            <span className="text-lg font-semibold text-white">Total:</span>
            <span className="text-xl font-bold text-blue-400 transition-all duration-500 transform">
              ${total}
            </span>
          </div>

          {!isMinimumMet && items.length > 0 && (
            <div className="mb-4 p-3 bg-orange-900/30 border border-orange-500/50 rounded-lg">
              <div className="flex items-center space-x-2 mb-2">
                <AlertCircle className="h-4 w-4 text-orange-400" />
                <span className="text-sm font-medium text-orange-300">Minimum Required</span>
              </div>
              <p className="text-xs text-orange-200">
                Your cart total is ${total}. Please add ${amountNeeded} more to reach the minimum booking amount of ${MINIMUM_BOOKING_AMOUNT}.
              </p>
            </div>
          )}

          <button
            onClick={onBook}
            disabled={!isMinimumMet}
            className={`w-full font-semibold py-3 rounded-lg transition-all duration-200 flex items-center justify-center space-x-2 ${
              isMinimumMet
                ? 'bg-green-600 hover:bg-green-700 text-white hover:scale-105 hover:shadow-lg'
                : 'bg-slate-600 text-slate-400 cursor-not-allowed opacity-50'
            }`}
          >
            <Calendar className="h-4 w-4" />
            <span>{isMinimumMet ? 'Book Service' : `Add $${amountNeeded} to Book`}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
