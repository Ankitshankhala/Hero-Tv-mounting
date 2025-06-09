
import React, { useState } from 'react';
import { Header } from '@/components/Header';
import { ServicesSection } from '@/components/ServicesSection';
import { ReviewsSection } from '@/components/ReviewsSection';
import { BlogSection } from '@/components/BlogSection';
import { Cart } from '@/components/Cart';
import { CheckoutModal } from '@/components/CheckoutModal';

export interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  options?: {
    over65: boolean;
    frameMount: boolean;
    numberOfTvs: number;
    cableConcealment: string;
    wallType: string;
  };
}

const Index = () => {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);

  const addToCart = (item: CartItem) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) {
        return prev.map(i => 
          i.id === item.id 
            ? { ...i, quantity: i.quantity + item.quantity, options: item.options || i.options }
            : i
        );
      }
      return [...prev, item];
    });
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const getTotalPrice = () => {
    return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <Header />
      
      <main className="relative">
        <ServicesSection onAddToCart={addToCart} />
        <ReviewsSection />
        <BlogSection />
        
        {cart.length > 0 && (
          <Cart 
            items={cart}
            total={getTotalPrice()}
            onCheckout={() => setIsCheckoutOpen(true)}
            onRemoveItem={removeFromCart}
          />
        )}
        
        {isCheckoutOpen && (
          <CheckoutModal
            cart={cart}
            total={getTotalPrice()}
            onClose={() => setIsCheckoutOpen(false)}
          />
        )}
      </main>
    </div>
  );
};

export default Index;
