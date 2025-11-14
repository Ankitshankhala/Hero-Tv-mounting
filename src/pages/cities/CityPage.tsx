import React, { useState } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { ServicesSection } from '@/components/ServicesSection';
import { ReviewsSection } from '@/components/ReviewsSection';
import { Cart } from '@/components/Cart';
import { EnhancedInlineBookingFlow } from '@/components/EnhancedInlineBookingFlow';
import { TestingModeIndicator } from '@/components/TestingModeIndicator';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { SEO } from '@/components/SEO';
import { getCityBySlug } from '@/data/cities';
import { CartItem } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { useTestingMode, getEffectiveMinimumAmount } from '@/contexts/TestingModeContext';
import { MapPin, Clock, Shield, Wrench } from 'lucide-react';

const CityPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const { isTestingMode } = useTestingMode();
  const MINIMUM_BOOKING_AMOUNT = getEffectiveMinimumAmount(isTestingMode);
  const { toast } = useToast();
  
  // Handle both /locations/:slug and /:slug-tv-mounting routes
  const citySlug = slug?.endsWith('-tv-mounting') 
    ? slug.replace('-tv-mounting', '') 
    : slug;
  
  const city = citySlug ? getCityBySlug(citySlug) : null;

  const [cart, setCart] = useState<CartItem[]>([]);
  const [showBookingFlow, setShowBookingFlow] = useState(false);
  const [highlightedItemId, setHighlightedItemId] = useState<string | null>(null);

  if (!city) {
    return <Navigate to="/" replace />;
  }

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
    setCart([]);
    toast({
      title: "Booking Confirmed! 🎉",
      description: "Your booking has been created successfully. You will receive a confirmation email shortly.",
    });
  };

  const selectedServices = cart.map(item => ({
    id: item.id,
    name: item.name,
    price: item.price,
    quantity: item.quantity
  }));

  const currentUrl = typeof window !== 'undefined' ? window.location.href : '';
  const canonicalUrl = typeof window !== 'undefined' ? `${window.location.origin}${city.path}` : '';

  const jsonLdData = [
    {
      "@context": "https://schema.org",
      "@type": "LocalBusiness",
      "name": `Hero TV Mounting — ${city.city}`,
      "description": `Professional TV mounting services in ${city.fullName}`,
      "url": canonicalUrl,
      "telephone": "+1-575-208-8997",
      "address": {
        "@type": "PostalAddress",
        "addressLocality": city.city,
        "addressRegion": city.state,
        "addressCountry": "US"
      },
      "areaServed": {
        "@type": "Place",
        "name": city.fullName
      },
      "serviceArea": {
        "@type": "GeoCircle",
        "geoMidpoint": {
          "@type": "GeoCoordinates",
          "addressLocality": city.city,
          "addressRegion": city.state,
          "addressCountry": "US"
        }
      }
    },
    {
      "@context": "https://schema.org",
      "@type": "Service",
      "serviceType": "TV Mounting",
      "provider": {
        "@type": "LocalBusiness",
        "name": `Hero TV Mounting — ${city.city}`
      },
      "areaServed": city.fullName,
      "offers": {
        "@type": "Offer",
        "priceCurrency": "USD",
        "price": "90",
        "description": "Professional TV mounting service"
      }
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": [
        {
          "@type": "ListItem",
          "position": 1,
          "name": "Home",
          "item": typeof window !== 'undefined' ? window.location.origin : ''
        },
        {
          "@type": "ListItem",
          "position": 2,
          "name": `${city.city} TV Mounting`,
          "item": canonicalUrl
        }
      ]
    }
  ];

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <SEO 
        title={city.pageTitle}
        description={city.metaDescription}
        canonical={canonicalUrl}
        jsonLd={jsonLdData}
      />

      <Header />

      {/* Primary SEO H1 */}
      <section className="py-20 bg-gradient-to-br from-blue-900 via-purple-900 to-slate-900">
        <div className="container mx-auto px-4">
          <TestingModeIndicator />
          
          <div className="text-center max-w-4xl mx-auto">
            <h1 className="text-4xl md:text-6xl font-bold text-white mb-6">
              TV Mounting in {city.fullName}
            </h1>
            <p className="text-xl md:text-2xl text-blue-100 mb-8">
              Professional TV installation with same-day availability. Expert mounting, wire concealment, and secure installation in {city.city}.
            </p>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-12">
              <div className="text-center">
                <Clock className="h-8 w-8 mx-auto mb-2 text-blue-400" />
                <p className="text-sm text-blue-200">Same-Day Service</p>
              </div>
              <div className="text-center">
                <Shield className="h-8 w-8 mx-auto mb-2 text-blue-400" />
                <p className="text-sm text-blue-200">Fully Insured</p>
              </div>
              <div className="text-center">
                <Wrench className="h-8 w-8 mx-auto mb-2 text-blue-400" />
                <p className="text-sm text-blue-200">Expert Technicians</p>
              </div>
              <div className="text-center">
                <MapPin className="h-8 w-8 mx-auto mb-2 text-blue-400" />
                <p className="text-sm text-blue-200">Local Service</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Why Choose Us Section */}
      <section className="py-16 bg-slate-800">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-8">
              Why Choose Hero TV Mounting in {city.city}?
            </h2>
            <div className="grid md:grid-cols-3 gap-8">
              <div className="text-center">
                <h3 className="text-xl font-semibold text-white mb-4">Local Expertise</h3>
                <p className="text-slate-300">
                  Our technicians know {city.city} homes and provide personalized service for every installation.
                </p>
              </div>
              <div className="text-center">
                <h3 className="text-xl font-semibold text-white mb-4">Professional Installation</h3>
                <p className="text-slate-300">
                  Expert mounting with proper anchoring, cable management, and safety checks for your peace of mind.
                </p>
              </div>
              <div className="text-center">
                <h3 className="text-xl font-semibold text-white mb-4">Quick Booking</h3>
                <p className="text-slate-300">
                  Book your TV mounting service online in minutes with flexible scheduling to fit your needs.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Neighborhoods Section */}
      <section className="py-16 bg-slate-900">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-8">
              Serving All {city.city} Neighborhoods
            </h2>
            <p className="text-xl text-slate-300 mb-8">
              We provide professional TV mounting services throughout {city.fullName} and surrounding areas.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {city.neighborhoods.map((neighborhood) => (
                <div key={neighborhood} className="bg-slate-800 rounded-lg p-4 text-center">
                  <p className="text-white font-medium">{neighborhood}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

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
    </div>
  );
};

export default CityPage;