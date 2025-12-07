
import React, { useState, lazy, Suspense } from 'react';
import { Header } from '@/components/Header';
import { useTestingMode, getEffectiveMinimumAmount } from '@/contexts/TestingModeContext';
import { Footer } from '@/components/Footer';
import { ServicesSection } from '@/components/ServicesSection';
import { ReviewsSection } from '@/components/ReviewsSection';
import { BlogSection } from '@/components/BlogSection';
import { Cart } from '@/components/Cart';
import { TestingModeIndicator } from '@/components/TestingModeIndicator';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { CartItem } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { SEO } from '@/components/SEO';

// Lazy load heavy components that are not needed for initial render
const EnhancedInlineBookingFlow = lazy(() => import('@/components/EnhancedInlineBookingFlow'));
const AuthModal = lazy(() => import('@/components/auth/AuthModal'));

// Minimal loading spinner for lazy components
const LazyLoader = () => (
  <div className="flex items-center justify-center p-8">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
  </div>
);

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
      <SEO 
        title="Hero TV Mounting | Professional TV Mounting Services"
        description="Fast, professional TV mounting, cable concealment, and furniture assembly. Book same-day service."
        jsonLd={[
          {
            "@context": "https://schema.org",
            "@type": "Organization",
            "name": "Hero TV Mounting",
            "url": typeof window !== 'undefined' ? window.location.origin : 'https://herotvmounting.com',
            "logo": "/assets/images/logo.png"
          },
          {
            "@context": "https://schema.org",
            "@type": "Service",
            "serviceType": "TV Mounting",
            "provider": { "@type": "Organization", "name": "Hero TV Mounting" },
            "areaServed": "US",
            "offers": { "@type": "Offer", "priceCurrency": "USD", "price": "90" }
          }
        ]}
      />

      <Header />

      {/* Primary SEO H1 (visually hidden to preserve single-H1 for SEO) */}
      <h1 className="sr-only">Hero TV Mounting — Professional TV Mounting Services</h1>

      {/* Testing Mode Indicator */}
      <div className="container mx-auto px-6 pt-4">
        <TestingModeIndicator />
      </div>

        <ErrorBoundary
          fallback={
            <section className="py-20 bg-gradient-to-b from-slate-900 to-slate-800 min-h-[800px]">
              <div className="container mx-auto px-4">
                <div className="text-center mb-16">
                  <h2 className="text-4xl font-bold text-white mb-4">Our Services</h2>
                  <div className="max-w-2xl mx-auto">
                    <div className="bg-red-900/20 border-2 border-red-500/50 rounded-xl p-8 text-center backdrop-blur-sm">
                      <p className="text-red-200 mb-4">Something went wrong loading our services.</p>
                      <button 
                        onClick={() => window.location.reload()}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg transition-all"
                      >
                        Reload Page
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          }
        >
          <ServicesSection onAddToCart={addToCart} />
        </ErrorBoundary>
        <ReviewsSection />
        <BlogSection />
        
        {/* Service Areas Section */}
        <section className="py-16 bg-slate-800">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                Service Areas in Texas
              </h2>
              <p className="text-slate-300 text-lg max-w-2xl mx-auto">
                We provide professional TV mounting services across major Texas cities with same-day availability.
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6 max-w-6xl mx-auto">
              <a 
                href="/locations/austin"
                className="bg-slate-700 hover:bg-slate-600 rounded-lg p-6 text-center transition-colors duration-200 group"
              >
                <h3 className="text-xl font-semibold text-white mb-2 group-hover:text-blue-300">Austin</h3>
                <p className="text-slate-400 text-sm">Professional TV mounting in Austin, TX</p>
              </a>
              
              <a 
                href="/locations/san-antonio"
                className="bg-slate-700 hover:bg-slate-600 rounded-lg p-6 text-center transition-colors duration-200 group"
              >
                <h3 className="text-xl font-semibold text-white mb-2 group-hover:text-blue-300">San Antonio</h3>
                <p className="text-slate-400 text-sm">Expert TV mounting in San Antonio, TX</p>
              </a>
              
              <a 
                href="/locations/fort-worth"
                className="bg-slate-700 hover:bg-slate-600 rounded-lg p-6 text-center transition-colors duration-200 group"
              >
                <h3 className="text-xl font-semibold text-white mb-2 group-hover:text-blue-300">Fort Worth</h3>
                <p className="text-slate-400 text-sm">Reliable TV mounting in Fort Worth, TX</p>
              </a>
              
              <a 
                href="/locations/dallas"
                className="bg-slate-700 hover:bg-slate-600 rounded-lg p-6 text-center transition-colors duration-200 group"
              >
                <h3 className="text-xl font-semibold text-white mb-2 group-hover:text-blue-300">Dallas</h3>
                <p className="text-slate-400 text-sm">Professional TV mounting in Dallas, TX</p>
              </a>
              
              <a 
                href="/locations/houston"
                className="bg-slate-700 hover:bg-slate-600 rounded-lg p-6 text-center transition-colors duration-200 group"
              >
                <h3 className="text-xl font-semibold text-white mb-2 group-hover:text-blue-300">Houston</h3>
                <p className="text-slate-400 text-sm">Top-rated TV mounting in Houston, TX</p>
              </a>
            </div>
          </div>
        </section>
        
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
                Technician Login
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

      {/* Booking Flow - Lazy loaded */}
      {showBookingFlow && (
        <Suspense fallback={<LazyLoader />}>
          <EnhancedInlineBookingFlow
            isOpen={showBookingFlow}
            onClose={() => setShowBookingFlow(false)}
            onSubmit={handleBookingComplete}
            selectedServices={selectedServices}
          />
        </Suspense>
      )}

      {/* Auth Modal - Lazy loaded */}
      <Suspense fallback={null}>
        <AuthModal open={showAuthModal} onOpenChange={setShowAuthModal} />
      </Suspense>
    </div>
  );
};

export default Index;
