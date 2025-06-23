
import React, { useState } from 'react';
import { ServiceCard } from './ServiceCard';
import { TvMountingModal } from './TvMountingModal';
import { EnhancedInlineBookingFlow } from './EnhancedInlineBookingFlow';
import { CartItem } from '@/types';
import { usePublicServicesData } from '@/hooks/usePublicServicesData';

interface ServicesSectionProps {
  onAddToCart: (item: CartItem) => void;
}

const getServiceImage = (serviceName: string) => {
  const imageMap: { [key: string]: string } = {
    'TV Mounting': '/lovable-uploads/9b4cf239-a12b-4275-9ca2-a4abafb59c40.png',
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
  const [showEnhancedBooking, setShowEnhancedBooking] = useState(false);
  const [selectedServices, setSelectedServices] = useState<Array<{
    id: string;
    name: string;
    price: number;
    quantity: number;
  }>>([]);
  const { services, loading } = usePublicServicesData();

  const handleServiceClick = (serviceId: string, serviceName: string) => {
    if (serviceName === 'TV Mounting') {
      setShowTvModal(true);
    } else {
      // For other services, start the enhanced booking flow
      const service = services.find(s => s.id === serviceId);
      if (service) {
        const serviceItem = {
          id: serviceId,
          name: serviceName,
          price: service.base_price,
          quantity: 1
        };
        setSelectedServices([serviceItem]);
        setShowEnhancedBooking(true);
        onAddToCart(serviceItem);
      }
    }
  };

  const handleTvMountingComplete = (cartItems: CartItem[]) => {
    // Add items to cart and start booking flow
    cartItems.forEach(item => onAddToCart(item));
    
    // Convert CartItem[] to the format expected by EnhancedInlineBookingFlow
    const enhancedServices = cartItems.map(item => ({
      id: item.id,
      name: item.name,
      price: item.price,
      quantity: item.quantity
    }));
    
    setSelectedServices(enhancedServices);
    setShowTvModal(false);
    setShowEnhancedBooking(true);
  };

  const handleBookingComplete = (data: any) => {
    console.log('Booking completed:', data);
    setShowEnhancedBooking(false);
    setSelectedServices([]);
  };

  if (loading) {
    return (
      <section className="py-20 bg-gradient-to-b from-slate-900 to-slate-800">
        <div className="container mx-auto px-4">
          <div className="text-center">
            <p className="text-white">Loading services...</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-20 bg-gradient-to-b from-slate-900 to-slate-800">
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

      {showEnhancedBooking && (
        <EnhancedInlineBookingFlow
          isOpen={showEnhancedBooking}
          onClose={() => {
            setShowEnhancedBooking(false);
            setSelectedServices([]);
          }}
          onSubmit={handleBookingComplete}
          selectedServices={selectedServices}
        />
      )}
    </section>
  );
};
