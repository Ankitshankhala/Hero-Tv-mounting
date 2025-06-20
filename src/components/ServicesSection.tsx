
import React, { useState } from 'react';
import { ArrowRight, Monitor, Wrench, Home, Star, CheckCircle } from 'lucide-react';
import { ServiceCard } from './ServiceCard';
import { TvMountingModal } from './TvMountingModal';
import { EmbeddedCheckout } from './EmbeddedCheckout';
import { Button } from './ui/button';
import { CartItem } from '@/types';

interface ServicesSectionProps {
  onAddToCart: (item: CartItem) => void;
}

export const ServicesSection = ({ onAddToCart }: ServicesSectionProps) => {
  const [showTvModal, setShowTvModal] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);

  const handleAddToCart = (item: CartItem) => {
    setCart([item]); // Replace cart with new item for immediate checkout
    onAddToCart(item);
    setShowCheckout(true);
  };

  const services = [
    {
      id: 'tv-mounting',
      name: 'TV Wall Mounting',
      description: 'Professional TV mounting with cable management',
      price: 90,
      image: '/lovable-uploads/77f65da7-38bc-4d01-afdd-bb998049c77b.png',
      features: ['Secure wall mounting', 'Cable hiding', 'Level adjustment', '30-day guarantee'],
      buttonText: 'Configure & Book',
      onClick: () => setShowTvModal(true)
    },
    {
      id: 'furniture-assembly',
      name: 'Furniture Assembly',
      description: 'Expert assembly for all types of furniture',
      price: 60,
      image: '/lovable-uploads/094e9449-a946-4941-9e0f-955113646365.png',
      features: ['All furniture types', 'Fast and reliable', 'Tools included', 'Cleanup service'],
      buttonText: 'Get a Quote',
      onClick: () => alert('Furniture Assembly clicked')
    },
    {
      id: 'smart-home-setup',
      name: 'Smart Home Setup',
      description: 'Setup and configuration of smart home devices',
      price: 75,
      image: '/lovable-uploads/499a9999-ca36-45a1-8a91-cb98a9489443.png',
      features: ['Device integration', 'Network setup', 'Voice control', 'Personalized training'],
      buttonText: 'Explore Options',
      onClick: () => alert('Smart Home Setup clicked')
    },
  ];

  // Create proper Service objects for TvMountingModal
  const modalServices = [
    { 
      id: '1', 
      name: 'TV Mounting', 
      base_price: 90,
      description: 'Professional TV wall mounting service',
      duration_minutes: 60,
      is_active: true,
      created_at: new Date().toISOString(),
      image_url: '/lovable-uploads/77f65da7-38bc-4d01-afdd-bb998049c77b.png'
    },
    { 
      id: '2', 
      name: 'Over 65" TV Add-on', 
      base_price: 25,
      description: 'Additional service for TVs over 65 inches',
      duration_minutes: 30,
      is_active: true,
      created_at: new Date().toISOString(),
      image_url: null
    },
    { 
      id: '3', 
      name: 'Frame Mount Add-on', 
      base_price: 25,
      description: 'Premium frame mounting option',
      duration_minutes: 15,
      is_active: true,
      created_at: new Date().toISOString(),
      image_url: null
    },
    { 
      id: '4', 
      name: 'Cable Management Add-on', 
      base_price: 20,
      description: 'Professional cable hiding and management',
      duration_minutes: 30,
      is_active: true,
      created_at: new Date().toISOString(),
      image_url: null
    }
  ];

  const getTotalPrice = () => {
    return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

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
          {services.map((service, index) => (
            <ServiceCard 
              key={index} 
              id={service.id}
              name={service.name}
              price={service.price}
              image={service.image}
              description={service.description}
              onAddToCart={service.onClick === (() => setShowTvModal(true)) ? handleAddToCart : () => {}}
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
          services={modalServices}
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
