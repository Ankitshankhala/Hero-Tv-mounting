
import React from 'react';
import { X } from 'lucide-react';

interface EmbeddedCheckoutProps {
  cart: any[];
  total: number;
  onClose: () => void;
  onSuccess: () => void;
}

export const EmbeddedCheckout = ({ onClose }: EmbeddedCheckoutProps) => {
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-lg transition-all duration-200"
        >
          <X className="h-5 w-5" />
        </button>
        
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          Booking System Updated
        </h2>
        <p className="text-gray-600 mb-6">
          We've moved to a new streamlined booking experience. Please use the "Book Now" buttons on our service cards.
        </p>
        <button
          onClick={onClose}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors"
        >
          Got it
        </button>
      </div>
    </div>
  );
};
