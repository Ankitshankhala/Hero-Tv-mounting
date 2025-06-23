
import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ServicesSection } from '@/components/ServicesSection';
import { CartItem } from '@/types';
import { ShoppingCart, ArrowRight, Star } from 'lucide-react';

interface ServiceSelectionProps {
  cart: CartItem[];
  onAddToCart: (item: CartItem) => void;
  onContinue: () => void;
  getTotalPrice: () => number;
}

export const ServiceSelection = ({ cart, onAddToCart, onContinue, getTotalPrice }: ServiceSelectionProps) => {
  return (
    <div className="space-y-12">
      {/* Header Section */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center space-x-2 bg-gradient-to-r from-blue-500/20 to-purple-500/20 backdrop-blur-sm border border-blue-500/30 rounded-full px-6 py-2 mb-4">
          <Star className="h-4 w-4 text-yellow-400" />
          <span className="text-sm font-medium text-blue-200">Step 1 of 3</span>
        </div>
        <h2 className="text-4xl font-bold text-white mb-4 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
          Select Your Services
        </h2>
        <p className="text-xl text-slate-300 max-w-2xl mx-auto leading-relaxed">
          Choose from our professional services and customize your experience
        </p>
      </div>

      {/* Services Section */}
      <div className="relative">
        <ServicesSection onAddToCart={onAddToCart} />
      </div>
      
      {/* Cart Summary */}
      {cart.length > 0 && (
        <div className="flex justify-center animate-fade-in">
          <Card className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 shadow-2xl max-w-md w-full">
            <CardHeader className="pb-4">
              <CardTitle className="text-white flex items-center space-x-3">
                <div className="p-2 bg-gradient-to-r from-green-500 to-emerald-500 rounded-lg">
                  <ShoppingCart className="h-5 w-5 text-white" />
                </div>
                <span>Your Selection</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Cart Items */}
              <div className="space-y-3">
                {cart.map((item) => (
                  <div key={item.id} className="flex justify-between items-center p-3 bg-white/5 rounded-lg border border-white/10">
                    <div className="flex-1">
                      <span className="text-white font-medium">{item.name}</span>
                      <span className="text-blue-300 text-sm ml-2">(x{item.quantity})</span>
                    </div>
                    <span className="text-emerald-400 font-bold text-lg">${item.price * item.quantity}</span>
                  </div>
                ))}
              </div>
              
              {/* Total */}
              <div className="border-t border-white/20 pt-4">
                <div className="flex justify-between items-center p-4 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-lg border border-blue-500/30">
                  <span className="text-xl font-bold text-white">Total:</span>
                  <span className="text-2xl font-bold text-emerald-400">${getTotalPrice()}</span>
                </div>
              </div>
              
              {/* Continue Button */}
              <Button 
                onClick={onContinue} 
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold py-3 rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
              >
                <span>Continue to Location</span>
                <ArrowRight className="h-5 w-5 ml-2" />
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Empty State */}
      {cart.length === 0 && (
        <div className="text-center py-12">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-700/50 rounded-full mb-4">
            <ShoppingCart className="h-8 w-8 text-slate-400" />
          </div>
          <p className="text-slate-400 text-lg">Select services to continue</p>
        </div>
      )}
    </div>
  );
};
