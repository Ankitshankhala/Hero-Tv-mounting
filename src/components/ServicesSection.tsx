import React, { useState } from 'react';
import { ServiceCard } from './ServiceCard';
import { TvMountingModal } from './TvMountingModal';
import { CartItem } from '@/types';
import { useServicesCache } from '@/contexts/ServicesCacheContext';

interface ServicesSectionProps {
  onAddToCart: (item: CartItem) => void;
}

const GENERIC_PLACEHOLDER = '/lovable-uploads/885a4cd2-a143-4e2e-b07c-e10030eb73c1.png';

export const ServicesSection = ({ onAddToCart }: ServicesSectionProps) => {
  const [showTvModal, setShowTvModal] = useState(false);
  const { publicServices, isLoading } = useServicesCache();

  const handleServiceClick = (serviceId: string, serviceName: string) => {
    if (serviceName === 'Mount TV') {
      setShowTvModal(true);
    } else {
      const service = publicServices.find(s => s.id === serviceId);
      if (service) {
        const serviceItem = {
          id: serviceId,
          name: serviceName,
          price: service.base_price ?? 0,
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

  // LOADING STATE - only shown briefly before cache/fallback initializes
  if (isLoading && publicServices.length === 0) {
    return (
      <section className="py-20 bg-gradient-to-b from-slate-900 to-slate-800 min-h-[800px]" id="services">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-4">Our Services</h2>
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

  // EMPTY STATE - virtually impossible with fallbacks
  if (publicServices.length === 0) {
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
          <h2 className="text-4xl font-bold text-white mb-4">Our Services</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
          {publicServices.map((service) => (
            <ServiceCard 
              key={service.id}
              id={service.id}
              name={service.name}
              price={service.base_price ?? 0}
              image={service.image_url || GENERIC_PLACEHOLDER}
              fallbackImage={GENERIC_PLACEHOLDER}
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
          services={publicServices}
        />
      )}
    </section>
  );
};
