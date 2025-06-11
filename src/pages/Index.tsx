
import React, { useState } from 'react';
import { Header } from '@/components/Header';
import { ServicesSection } from '@/components/ServicesSection';
import { ReviewsSection } from '@/components/ReviewsSection';
import { BlogSection } from '@/components/BlogSection';
import { Cart } from '@/components/Cart';
import { InlineBookingFlow } from '@/components/InlineBookingFlow';
import { Toaster } from '@/components/ui/toaster';
import { useToast } from '@/hooks/use-toast';

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
  const [isBookingFlowOpen, setIsBookingFlowOpen] = useState(false);
  const [highlightedItemId, setHighlightedItemId] = useState<string | null>(null);
  const { toast } = useToast();

  const addToCart = (item: CartItem) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) {
        // Show toast for updated item
        toast({
          title: "Service Updated",
          description: `${item.name} has been updated in your cart`,
        });
        
        return prev.map(i => 
          i.id === item.id 
            ? { ...i, quantity: i.quantity + item.quantity, options: item.options || i.options }
            : i
        );
      } else {
        // Show toast for new item
        toast({
          title: "Service Added",
          description: `${item.name} has been added to your cart`,
        });
        
        // Highlight the newly added item
        setHighlightedItemId(item.id);
        setTimeout(() => setHighlightedItemId(null), 2000);
        
        return [...prev, item];
      }
    });
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
    toast({
      title: "Service Removed",
      description: "Service has been removed from your cart",
      variant: "destructive",
    });
  };

  const getTotalPrice = () => {
    return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  const handleBookNow = () => {
    setIsBookingFlowOpen(true);
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
            onRemoveItem={removeFromCart}
            highlightedItemId={highlightedItemId}
            onBook={handleBookNow}
          />
        )}
        
        {isBookingFlowOpen && (
          <InlineBookingFlow
            cart={cart}
            onClose={() => setIsBookingFlowOpen(false)}
          />
        )}
      </main>
      
      <Toaster />
    </div>
  );
};

export default Index;
