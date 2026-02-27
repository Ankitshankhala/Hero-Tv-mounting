import React, { useState, useEffect } from 'react';
import { ServiceCard } from './ServiceCard';
import { TvMountingModal } from './TvMountingModal';
import { CartItem } from '@/types';
import { usePublicServicesData } from '@/hooks/usePublicServicesData';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ServicesSectionProps {
  onAddToCart: (item: CartItem) => void;
}

const getServiceImage = (serviceName: string): string => {
  const imageMap: { [key: string]: string } = {
    'Mount TV': '/lovable-uploads/9b4cf239-a12b-4275-9ca2-a4abafb59c40.png',
    'Full Motion Mount': '/lovable-uploads/77f65da7-38bc-4d01-afdd-bb998049c77b.png',
    'Flat Mount': '/lovable-uploads/4a49b814-b16a-4daf-aa91-3a52fcbb5fae.png',
    'Cover Cables': '/lovable-uploads/6889f051-f5b1-4f2a-a093-a09693378bd4.png',
    'Simple Cable Concealment': '/lovable-uploads/cf56b4f9-cc16-4662-ba09-6186268ae1a0.png',
    'Fire Safe Cable Concealment': '/lovable-uploads/ebfd43c9-5c9d-4d15-b395-a22f44063cb6.png',
    'General Mounting': '/lovable-uploads/a5b8dff7-04c1-4590-a491-0d8a7f9d004c.png',
    'Furniture Assembly': '/lovable-uploads/fe916134-126d-4cff-aefa-608f842b536a.png',
    'Hire Second Technician': '/lovable-uploads/f430204b-2ef5-4727-b3ee-7f4d9d26ded4.png'
  };
  
  return imageMap[serviceName] || '/lovable-uploads/885a4cd2-a143-4e2e-b07c-e10030eb73c1.png';
};

export const ServicesSection = ({ onAddToCart }: ServicesSectionProps) => {
  const [showTvModal, setShowTvModal] = useState(false);
  const [loadingTimeout, setLoadingTimeout] = useState(false);
  const { services, loading, error, retryCount, refetch } = usePublicServicesData();

  // Safety: If loading takes more than 30 seconds, show timeout message
  useEffect(() => {
    if (loading) {
      const timer = setTimeout(() => {
        setLoadingTimeout(true);
      }, 30000);
      return () => clearTimeout(timer);
    } else {
      setLoadingTimeout(false);
    }
  }, [loading]);

  const handleServiceClick = (serviceId: string, serviceName: string) => {
    if (serviceName === 'Mount TV') {
      setShowTvModal(true);
    } else {
      const service = services.find(s => s.id === serviceId);
      if (service) {
        const serviceItem = {
          id: serviceId,
          name: serviceName,
          price: service.base_price,
          quantity: 1
        };
        onAddToCart(serviceItem);
      }
    }
  };

  const handleTvMountingComplete = (cartItems: CartItem[]) => {
    cartItems.forEach(item => onAddToCart(item));
    setShowTvModal(false);
  };

  // ERROR STATE
  if (error) {
    return (
      <section className="py-20 bg-gradient-to-b from-slate-900 to-slate-800 min-h-[800px]" id="services">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-4">Our Services</h2>
          </div>

          <div className="max-w-2xl mx-auto">
            <div className="bg-red-900/20 border-2 border-red-500/50 rounded-xl p-8 text-center backdrop-blur-sm">
              <AlertTriangle className="w-16 h-16 text-red-400 mx-auto mb-4" />
              <h3 className="text-2xl font-bold text-white mb-3">Unable to Load Services</h3>
              <p className="text-red-200 mb-2">{error.message}</p>
              {retryCount > 0 && (
                <p className="text-red-300 text-sm mb-6">
                  Attempted {retryCount + 1} times
                </p>
              )}
              <Button 
                onClick={refetch}
                className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg transition-all transform hover:scale-105"
                size="lg"
              >
                <RefreshCw className="w-5 h-5 mr-2" />
                Try Again
              </Button>
            </div>
          </div>
        </div>
      </section>
    );
  }

  // LOADING STATE
  if (loading) {
    return (
      <section className="py-20 bg-gradient-to-b from-slate-900 to-slate-800 min-h-[800px]" id="services">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-4">
              {loadingTimeout ? 'Still Loading Services...' : 'Our Services'}
            </h2>
            {loadingTimeout && (
              <p className="text-yellow-400 text-sm">
                This is taking longer than expected. Please check your connection.
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
            {[...Array(6)].map((_, index) => (
              <div 
                key={`skeleton-${index}`}
                className="bg-slate-900/80 backdrop-blur-sm rounded-xl overflow-hidden border border-slate-700 min-h-[400px] animate-pulse"
              >
                <div className="relative w-full overflow-hidden aspect-[4/3]">
                  <div className="w-full h-full bg-slate-700" />
                </div>
                <div className="p-6">
                  <div className="h-6 bg-slate-700 rounded mb-3" />
                  <div className="space-y-2 mb-4">
                    <div className="h-4 bg-slate-700 rounded" />
                    <div className="h-4 bg-slate-700 rounded w-3/4" />
                  </div>
                  <div className="flex justify-between items-center mb-4">
                    <div className="h-6 bg-slate-700 rounded w-20" />
                  </div>
                  <div className="h-10 bg-slate-700 rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  // EMPTY STATE
  if (services.length === 0) {
    return (
      <section className="py-20 bg-gradient-to-b from-slate-900 to-slate-800 min-h-[800px]" id="services">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-4">Our Services</h2>
          </div>

          <div className="max-w-2xl mx-auto text-center">
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-12 backdrop-blur-sm">
              <p className="text-slate-400 text-lg mb-4">No services are currently available.</p>
              <p className="text-slate-500 text-sm">Please check back later or contact us for assistance.</p>
            </div>
          </div>
        </div>
      </section>
    );
  }

  // SUCCESS STATE
  return (
    <section className="py-20 bg-gradient-to-b from-slate-900 to-slate-800 min-h-[800px]" id="services">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-white mb-4">
            Our Services
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
          {services.map((service) => (
            <ServiceCard 
              key={service.id}
              id={service.id}
              name={service.name}
              price={service.base_price}
              image={service.image_url || getServiceImage(service.name)}
              description={service.description || `Professional ${service.name.toLowerCase()} service`}
              onAddToCart={() => handleServiceClick(service.id, service.name)}
            />
          ))}
        </div>
      </div>

      {showTvModal && (
        <TvMountingModal
          open={showTvModal}
          onClose={() => setShowTvModal(false)}
          onAddToCart={handleTvMountingComplete}
          services={services}
        />
      )}
    </section>
  );
};