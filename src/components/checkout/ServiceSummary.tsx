
import React from 'react';
import { CheckCircle } from 'lucide-react';
import type { CartItem } from '@/types';

interface ServiceSummaryProps {
  cart: CartItem[];
  total: number;
}

export const ServiceSummary = ({ cart, total }: ServiceSummaryProps) => {
  return (
    <div className="bg-gradient-to-r from-emerald-50 to-green-50 border-2 border-emerald-200 rounded-2xl p-6 shadow-sm">
      <h3 className="font-bold text-emerald-800 mb-4 flex items-center text-lg">
        <CheckCircle className="h-6 w-6 text-emerald-600 mr-3" />
        Service Summary
      </h3>
      <div className="space-y-4">
        {cart.map((item, index) => (
          <div key={index} className="flex justify-between items-center p-4 bg-white rounded-xl shadow-sm border border-emerald-100">
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
              <span className="font-medium text-gray-800">{item.name}</span>
              <span className="text-emerald-600 text-sm font-medium">×{item.quantity}</span>
            </div>
            <span className="font-bold text-emerald-700 text-lg">${(item.price * item.quantity).toFixed(2)}</span>
          </div>
        ))}
        <div className="border-t-2 border-emerald-200 pt-4 mt-4">
          <div className="flex justify-between items-center">
            <span className="text-xl font-bold text-gray-900">Total Amount:</span>
            <span className="text-2xl font-bold text-emerald-700">${total.toFixed(2)}</span>
          </div>
          <p className="text-sm text-emerald-600 mt-3 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
            💳 Payment will be collected by our technician upon service completion
          </p>
        </div>
      </div>
    </div>
  );
};
