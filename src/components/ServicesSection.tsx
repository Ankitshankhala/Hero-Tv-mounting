
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
              image="/lovable-uploads/77f65da7-38bc-4d01-afdd-bb998049c77b.png"
              description={service.description || `Professional ${service.name.toLowerCase()} service`}
              onAddToCart={() => handleServiceClick(service.id, service.name)}
            />
          ))}
        </div>

        <div className="text-center mt-16">
          <div className="bg-slate-800 rounded-lg p-8 max-w-4xl mx-auto">
            <div className="flex items-center justify-center space-x-8 text-white">
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-6 w-6 text-green-400" />
                <span>Licensed & Insured</span>
              </div>
              <div className="flex items-center space-x-2">
                <Star className="h-6 w-6 text-yellow-400" />
                <span>4.9/5 Rating</span>
              </div>
              <div className="flex items-center space-x-2">
                <Home className="h-6 w-6 text-blue-400" />
                <span>Same Day Service</span>
              </div>
            </div>
          </div>
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
