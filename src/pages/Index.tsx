import React, { useState } from 'react';
import { Header } from '@/components/Header';
import { ServicesSection } from '@/components/ServicesSection';
import { ReviewsSection } from '@/components/ReviewsSection';
import { BlogSection } from '@/components/BlogSection';
import { Cart } from '@/components/Cart';
import { CheckoutModal } from '@/components/CheckoutModal';
import { Toaster } from '@/components/ui/toaster';
import { useToast } from '@/hooks/use-toast';
import { EmbeddedCheckout } from '@/components/EmbeddedCheckout';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

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
  const navigate = useNavigate();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [highlightedItemId, setHighlightedItemId] = useState<string | null>(null);
  const { toast } = useToast();

  const handleBookNow = () => {
    // Navigate to the full booking flow with calendar
    navigate('/book');
  };

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

  const handleCheckout = () => {
    setIsCheckoutOpen(true);
  };

  const getTotalPrice = () => {
    return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <Header />
      
      {/* Hero Section */}
      <section className="relative py-20 px-4">
        <div className="container mx-auto text-center">
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">
            Professional Home Services
            <span className="block text-blue-400">At Your Doorstep</span>
          </h1>
          <p className="text-xl text-slate-300 mb-8 max-w-2xl mx-auto">
            Expert technicians for all your home service needs. Fast, reliable, and professional service guaranteed.
          </p>
          <Button 
            size="lg" 
            className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 text-lg"
            onClick={handleBookNow}
          >
            Book Service Now
          </Button>
        </div>
      </section>

      <main className="relative">
        <ServicesSection onAddToCart={addToCart} />
        <ReviewsSection />
        <BlogSection />
        
        <Cart 
          items={cart} 
          onRemoveItem={removeFromCart} 
          onCheckout={handleCheckout}
          onBook={handleBookNow}
        />
        
        {isCheckoutOpen && (
          <EmbeddedCheckout
            cart={cart}
            total={getTotalPrice()}
            onClose={() => setIsCheckoutOpen(false)}
            onSuccess={() => {
              setCart([]);
              setIsCheckoutOpen(false);
            }}
          />
        )}
      </main>
      
      <Toaster />
    </div>
  );
};

export default Index;
