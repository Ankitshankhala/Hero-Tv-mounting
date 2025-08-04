
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Header } from '@/components/Header';
import { useTestingMode, getEffectiveMinimumAmount } from '@/contexts/TestingModeContext';
import { AuthModal } from '@/components/auth/AuthModal';
import { Footer } from '@/components/Footer';
import { ServicesSection } from '@/components/ServicesSection';
import { ReviewsSection } from '@/components/ReviewsSection';
import { BlogSection } from '@/components/BlogSection';
import { Cart } from '@/components/Cart';
import { EnhancedInlineBookingFlow } from '@/components/EnhancedInlineBookingFlow';
import { TestingModeIndicator } from '@/components/TestingModeIndicator';
import { CartItem } from '@/types';
import { useToast } from '@/hooks/use-toast';

const Index = () => {
  const { isTestingMode } = useTestingMode();
  const MINIMUM_BOOKING_AMOUNT = getEffectiveMinimumAmount(isTestingMode);
  
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showBookingFlow, setShowBookingFlow] = useState(false);
  const [highlightedItemId, setHighlightedItemId] = useState<string | null>(null);
  const { toast } = useToast();

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
    const total = getTotalPrice();
    
    if (total < MINIMUM_BOOKING_AMOUNT) {
      const amountNeeded = MINIMUM_BOOKING_AMOUNT - total;
      toast({
        title: "Minimum Booking Amount Required",
        description: `Your cart total is $${total}. Please add $${amountNeeded} more to reach the minimum booking amount of $${MINIMUM_BOOKING_AMOUNT}.`,
        variant: "destructive",
      });
      return;
    }

    if (cart.length > 0) {
      setShowBookingFlow(true);
    }
  };

  const handleBookingComplete = (data: any) => {
    console.log('Booking completed:', data);
    setShowBookingFlow(false);
    setCart([]); // Clear cart after successful booking
    toast({
      title: "Booking Confirmed! 🎉",
      description: "Your booking has been created successfully. You will receive a confirmation email shortly.",
    });
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
      
      {/* Testing Mode Indicator */}
      <div className="container mx-auto px-6 pt-4">
        <TestingModeIndicator />
      </div>

        <ServicesSection onAddToCart={addToCart} />
        <ReviewsSection />
        <BlogSection />
        
        {/* Worker Recruitment Section */}
        <section className="py-16 bg-gradient-to-r from-blue-900 to-purple-900">
          <div className="container mx-auto px-4 text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Join Our Professional Team
            </h2>
            <p className="text-blue-100 text-lg mb-8 max-w-2xl mx-auto">
              Are you an experienced technician looking for flexible work opportunities? 
              Join our team of professional TV mounting specialists and earn competitive pay.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a 
                href="/worker-signup"
                className="inline-flex items-center px-8 py-4 bg-white text-blue-900 font-semibold rounded-lg hover:bg-blue-50 transition-colors duration-200 shadow-lg"
              >
                Apply Now
              </a>
              <a 
                href="/worker-login"
                className="inline-flex items-center px-8 py-4 bg-transparent text-white font-semibold rounded-lg border-2 border-white hover:bg-white hover:text-blue-900 transition-colors duration-200"
              >
                Worker Login
              </a>
            </div>
          </div>
        </section>

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
