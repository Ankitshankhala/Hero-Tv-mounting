import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ServicesSection } from '@/components/ServicesSection';
import { CartItem } from '@/types';

interface ServiceSelectionProps {
  cart: CartItem[];
  onAddToCart: (item: CartItem) => void;
  onContinue: () => void;
  getTotalPrice: () => number;
}

export const ServiceSelection = ({ cart, onAddToCart, onContinue, getTotalPrice }: ServiceSelectionProps) => {
  return (
    <div>
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-white mb-4">Select Your Services</h2>
        <p className="text-slate-300">Choose the services you need</p>
      </div>
      <ServicesSection onAddToCart={onAddToCart} />
      
      {cart.length > 0 && (
        <div className="mt-8 max-w-md mx-auto">
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white">Your Selection</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {cart.map((item) => (
                <div key={item.id} className="flex justify-between items-center text-white">
                  <span>{item.name} (x{item.quantity})</span>
                  <span>${item.price * item.quantity}</span>
                </div>
              ))}
              <div className="border-t border-slate-600 pt-4">
                <div className="flex justify-between items-center text-lg font-bold text-white">
                  <span>Total: ${getTotalPrice()}</span>
                </div>
              </div>
              <Button onClick={onContinue} className="w-full">
                Continue to Location
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};
