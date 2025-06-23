
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Header } from '@/components/Header';
import { AuthModal } from '@/components/auth/AuthModal';
import { Footer } from '@/components/Footer';
import { ServicesSection } from '@/components/ServicesSection';
import { ReviewsSection } from '@/components/ReviewsSection';
import { BlogSection } from '@/components/BlogSection';
import { Cart } from '@/components/Cart';
import { EnhancedInlineBookingFlow } from '@/components/EnhancedInlineBookingFlow';
import { CartItem } from '@/types';

const Index = () => {
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showBookingFlow, setShowBookingFlow] = useState(false);
  const [highlightedItemId, setHighlightedItemId] = useState<string | null>(null);

  const addToCart = (item: CartItem) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) {
        return prev.map(i => 
          i.id === item.id 
            ? { ...i, quantity: i.quantity + item.quantity }
            : i
        );
      } else {
        // Highlight the newly added item
        setHighlightedItemId(item.id);
        setTimeout(() => setHighlightedItemId(null), 2000);
        return [...prev, item];
      }
    });
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const getTotalPrice = () => {
    return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  const handleBookService = () => {
    if (cart.length > 0) {
      setShowBookingFlow(true);
    }
  };

  const handleBookingComplete = (data: any) => {
    console.log('Booking completed:', data);
    setShowBookingFlow(false);
    setCart([]); // Clear cart after successful booking
  };

  // Convert cart items to the format expected by EnhancedInlineBookingFlow
  const selectedServices = cart.map(item => ({
    id: item.id,
    name: item.name,
    price: item.price,
    quantity: item.quantity
  }));

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <Header />

      <ServicesSection onAddToCart={addToCart} />
      <ReviewsSection />
      <BlogSection />

      <Footer />

      {/* Cart Display */}
      {cart.length > 0 && (
        <Cart
          items={cart}
          total={getTotalPrice()}
          onRemoveItem={removeFromCart}
          onBook={handleBookService}
          highlightedItemId={highlightedItemId}
        />
      )}

      {/* Booking Flow */}
      {showBookingFlow && (
        <EnhancedInlineBookingFlow
          isOpen={showBookingFlow}
          onClose={() => setShowBookingFlow(false)}
          onSubmit={handleBookingComplete}
          selectedServices={selectedServices}
        />
      )}

      <AuthModal open={showAuthModal} onOpenChange={setShowAuthModal} />
    </div>
  );
};

export default Index;
