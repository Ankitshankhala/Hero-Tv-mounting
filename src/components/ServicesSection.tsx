
import React, { useState } from 'react';
import { ServiceCard } from './ServiceCard';
import { TvMountingModal } from './TvMountingModal';
import { CartItem } from '@/types';
import { usePublicServicesData } from '@/hooks/usePublicServicesData';

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
  const { services, loading } = usePublicServicesData();

  const handleServiceClick = (serviceId: string, serviceName: string) => {
    // Check if this is Mount TV service - open modal instead
    if (serviceName === 'Mount TV') {
      setShowTvModal(true);
    } else {
      // For other services, just add to cart
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
    // Add items to cart only
    cartItems.forEach(item => onAddToCart(item));
    setShowTvModal(false);
  };

  if (loading) {
  return (
    <section className="py-20 bg-gradient-to-b from-slate-900 to-slate-800 min-h-[800px]">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="hidden text-4xl font-bold text-white mb-4">
            Our Services
          </h2>
        </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
            {[...Array(6)].map((_, index) => (
              <div 
                key={`skeleton-${index}`}
                className="bg-slate-900/80 backdrop-blur-sm rounded-xl overflow-hidden border border-slate-700 min-h-[400px]"
              >
                <div className="relative w-full overflow-hidden aspect-[4/3]">
                  <div className="w-full h-full bg-slate-700 animate-pulse" />
                </div>
                <div className="p-6">
                  <div className="h-6 bg-slate-700 rounded animate-pulse mb-3" />
                  <div className="space-y-2 mb-4">
                    <div className="h-4 bg-slate-700 rounded animate-pulse" />
                    <div className="h-4 bg-slate-700 rounded animate-pulse w-3/4" />
                  </div>
                  <div className="flex justify-between items-center mb-4">
                    <div className="h-6 bg-slate-700 rounded animate-pulse w-20" />
                  </div>
                  <div className="h-10 bg-slate-700 rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-20 bg-gradient-to-b from-slate-900 to-slate-800 min-h-[800px]">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="hidden text-4xl font-bold text-white mb-4">
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
