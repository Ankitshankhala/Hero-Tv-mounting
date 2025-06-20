
import React from 'react';
import { X, Sparkles } from 'lucide-react';

interface CheckoutHeaderProps {
  onClose: () => void;
  isProcessing: boolean;
}

export const CheckoutHeader = ({ onClose, isProcessing }: CheckoutHeaderProps) => {
  const handleClose = () => {
    if (!isProcessing) {
      onClose();
    }
  };

  return (
    <div className="relative bg-gradient-to-br from-indigo-600 via-blue-600 to-purple-700 text-white px-8 py-6 rounded-t-2xl">
      <button
        onClick={handleClose}
        disabled={isProcessing}
        className="absolute top-4 right-4 p-2 hover:bg-white/20 rounded-lg transition-all duration-200 disabled:opacity-50"
      >
        <X className="h-5 w-5" />
      </button>
      
      <div className="flex items-center space-x-4">
        <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
          <Sparkles className="h-7 w-7" />
        </div>
        <div>
          <h2 className="text-2xl font-bold mb-1">Book Your Service</h2>
          <p className="text-blue-100 text-sm">Complete your booking in just a few steps</p>
        </div>
      </div>
    </div>
  );
};
