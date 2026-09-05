
import React, { useState, lazy, Suspense, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Header } from '@/components/Header';

import { useTestingMode, getEffectiveMinimumAmount } from '@/contexts/TestingModeContext';
import { Footer } from '@/components/Footer';
import { ServicesSection } from '@/components/ServicesSection';
import { Cart } from '@/components/Cart';
import { TestingModeIndicator } from '@/components/TestingModeIndicator';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useInView } from '@/hooks/useInView';
import { CartItem } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { SEO } from '@/components/SEO';
import { getAllCities } from '@/data/cities';


// Lazy load heavy components that are not needed for initial render
const EnhancedInlineBookingFlow = lazy(() => import('@/components/EnhancedInlineBookingFlow'));
// V2 (payment-first) — gated behind `app_settings.payment_first_enabled`.
// Default OFF: when the flag is false/missing/errored, V1 above is used.
const EnhancedInlineBookingFlowV2 = lazy(() => import('@/components/EnhancedInlineBookingFlowV2'));
import { usePaymentFirstFlag } from '@/hooks/usePaymentFirstFlag';
const AuthModal = lazy(() => import('@/components/auth/AuthModal'));

// Below-the-fold sections — deferred to avoid blocking hero/services first paint.
const ReviewsSection = lazy(() =>
  import('@/components/ReviewsSection').then(m => ({ default: m.ReviewsSection }))
);
const BlogSection = lazy(() =>
  import('@/components/BlogSection').then(m => ({ default: m.BlogSection }))
);

// Wrapper: only mounts children once scrolled near viewport.
const DeferredSection: React.FC<{ children: React.ReactNode; minHeight?: number }> = ({ children, minHeight = 400 }) => {
  const { ref, inView } = useInView<HTMLDivElement>({ rootMargin: '300px' });
  return (
    <div ref={ref} style={{ minHeight: inView ? undefined : minHeight }}>
      {inView ? <Suspense fallback={null}>{children}</Suspense> : null}
    </div>
  );
};

// Minimal loading spinner for lazy components
const LazyLoader = () => (
  <div className="flex items-center justify-center p-8">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
  </div>
);

const Index = () => {
  const { isTestingMode } = useTestingMode();
  const { enabled: paymentFirstEnabled } = usePaymentFirstFlag();
  const MINIMUM_BOOKING_AMOUNT = getEffectiveMinimumAmount(isTestingMode);
  
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showBookingFlow, setShowBookingFlow] = useState(false);
  const [highlightedItemId, setHighlightedItemId] = useState<string | null>(null);
  const { toast } = useToast();

  // Prefetch the booking flow bundle as soon as the cart has items,
  // so the modal opens instantly when "Book Service" is clicked.
  const cartHasItems = cart.length > 0;
  useEffect(() => {
    if (cartHasItems) {
      import('@/components/EnhancedInlineBookingFlow').catch(() => {});
    }
  }, [cartHasItems]);

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
  const selectedServices = useMemo(
    () => cart.map(item => ({
      id: item.id,
      name: item.name,
      price: item.price,
      quantity: item.quantity
    })),
    [cart]
  );

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
        <DeferredSection minHeight={600}><ReviewsSection /></DeferredSection>
        <DeferredSection minHeight={600}><BlogSection /></DeferredSection>
        
        {/* Service Areas Section */}
        <section className="py-10 md:py-16 bg-slate-800">
          <div className="container mx-auto px-4">
            <div className="mb-6 md:mb-10 md:text-center">
              <h2 className="text-2xl md:text-4xl font-bold text-white mb-2">
                Service Areas
              </h2>
              <p className="text-slate-400 text-sm md:text-base md:max-w-2xl md:mx-auto">
                Proudly serving the Austin, Dallas, and Houston Metro Areas in Texas, plus Tampa, St. Petersburg, Orlando, Ft. Lauderdale, Miami Metro in Florida, and Atlanta Metro in Georgia.
              </p>
            </div>

            <div className="max-w-3xl mx-auto grid grid-cols-2 md:grid-cols-3 gap-2.5 md:gap-3">
              {getAllCities().map((c) => {
                const displayName = c.fullName.replace(/,\s*[A-Z]{2}$/, '');
                return (
                  <Link
                    key={c.slug}
                    to={c.path}
                    className="min-h-[44px] flex items-center justify-center px-3 py-2.5 rounded-lg bg-slate-700/70 hover:bg-slate-700 border border-slate-600 text-slate-100 text-sm font-medium transition-colors"
                  >
                    {displayName}
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        {/* Worker Recruitment Section */}
        <section className="py-10 md:py-16 bg-slate-900">
          <div className="container mx-auto px-4">
            <div className="max-w-3xl mx-auto rounded-2xl border border-slate-700 bg-slate-800/60 p-6 md:p-10 md:text-center">
              <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">
                Join Our Professional Team
              </h2>
              <p className="text-slate-300 text-sm md:text-base mb-5 md:mb-6 md:max-w-xl md:mx-auto">
                Experienced technician? Earn competitive pay with flexible work.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 md:justify-center">
                <a
                  href="/worker-signup"
                  className="inline-flex items-center justify-center min-h-[44px] px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
                >
                  Apply Now
                </a>
                <a
                  href="/worker-login"
                  className="inline-flex items-center justify-center min-h-[44px] px-5 py-2.5 bg-transparent text-white font-semibold rounded-lg border border-slate-600 hover:border-blue-500 hover:text-blue-400 transition-colors"
                >
                  Technician Login
                </a>
              </div>
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

      {/* Booking Flow - Lazy loaded. Flag OFF (default) → V1 unchanged. */}
      {showBookingFlow && (
        <Suspense fallback={<LazyLoader />}>
          {paymentFirstEnabled ? (
            <EnhancedInlineBookingFlowV2
              isOpen={showBookingFlow}
              onClose={() => setShowBookingFlow(false)}
              onSubmit={handleBookingComplete}
              selectedServices={selectedServices}
            />
          ) : (
            <EnhancedInlineBookingFlow
              isOpen={showBookingFlow}
              onClose={() => setShowBookingFlow(false)}
              onSubmit={handleBookingComplete}
              selectedServices={selectedServices}
            />
          )}
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
