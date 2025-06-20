
import React, { useState } from 'react';
import { ArrowRight, Monitor, Wrench, Home, Star, CheckCircle } from 'lucide-react';
import { ServiceCard } from './ServiceCard';
import { TvMountingModal } from './TvMountingModal';
import { EmbeddedCheckout } from './EmbeddedCheckout';
import { Button } from './ui/button';
import { CartItem } from '@/types';
import { useServicesData } from '@/hooks/useServicesData';

interface ServicesSectionProps {
  onAddToCart: (item: CartItem) => void;
}

const getServiceImage = (serviceName: string): string => {
  const serviceImages: { [key: string]: string } = {
    'TV Mounting': '/lovable-uploads/77f65da7-38bc-4d01-afdd-bb998049c77b.png',
    'Furniture Assembly': '/lovable-uploads/012bbdab-1222-48ae-aa4b-d7bb3c3aa632.png',
    'Plumbing': '/lovable-uploads/01571029-7b6a-4df2-9c0f-1c0b120fedff.png',
    'Electrical Work': '/lovable-uploads/15729bed-70cc-4a81-afe5-f295b900175d.png',
    'Home Repair': '/lovable-uploads/1cdefbf0-13c5-4f66-bb5c-761861d66f74.png',
    'Appliance Installation': '/lovable-uploads/27ce8bb9-eb88-4dd3-bd04-4525238f4f77.png',
    'Handyman Services': '/lovable-uploads/2ca84624-6945-44f1-8cf1-e35c574b9a1f.png',
    'Cleaning': '/lovable-uploads/30e56e23-dec2-4e93-a794-d7575b2e1bd5.png'
  };
  
  return serviceImages[serviceName] || '/lovable-uploads/77f65da7-38bc-4d01-afdd-bb998049c77b.png';
};

export const ServicesSection = ({ onAddToCart }: ServicesSectionProps) => {
  const [showTvModal, setShowTvModal] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const { services, loading } = useServicesData();

  const handleAddToCart = (item: CartItem) => {
    setCart([item]); // Replace cart with new item for immediate checkout
    onAddToCart(item);
    setShowCheckout(true);
  };

  const handleServiceClick = (serviceId: string, serviceName: string) => {
    if (serviceName === 'TV Mounting') {
      setShowTvModal(true);
    } else {
      // For other services, add directly to cart
      const service = services.find(s => s.id === serviceId);
      if (service) {
        handleAddToCart({
          id: serviceId,
          name: serviceName,
          price: service.base_price,
          quantity: 1
        });
      }
    }
  };

  const getTotalPrice = () => {
    return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
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
            Professional Home Services
          </h2>
          <p className="text-xl text-slate-300 max-w-2xl mx-auto">
            Expert technicians, competitive pricing, and satisfaction guaranteed
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
          {services.map((service) => (
            <ServiceCard 
              key={service.id}
              id={service.id}
              name={service.name}
              price={service.base_price}
              image={getServiceImage(service.name)}
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
          onAddToCart={handleAddToCart}
          services={services}
        />
      )}

      {showCheckout && (
        <EmbeddedCheckout
          cart={cart}
          total={getTotalPrice()}
          onClose={() => setShowCheckout(false)}
          onSuccess={() => {
            setCart([]);
            setShowCheckout(false);
          }}
        />
      )}
    </section>
  );
};
