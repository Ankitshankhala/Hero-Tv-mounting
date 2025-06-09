
import React, { useState } from 'react';
import { ServiceCard } from './ServiceCard';
import { TvMountingModal } from './TvMountingModal';
import { CartItem } from '@/pages/Index';

interface ServicesSectionProps {
  onAddToCart: (item: CartItem) => void;
}

export const ServicesSection: React.FC<ServicesSectionProps> = ({ onAddToCart }) => {
  const [isTvMountingModalOpen, setIsTvMountingModalOpen] = useState(false);

  const services = [
    {
      id: 'tv-mounting',
      name: 'TV Mounting',
      price: 100,
      image: '/lovable-uploads/36bcb39b-be12-4c6c-b316-613711e99f29.png',
      description: 'Professional TV wall mounting with perfect positioning'
    },
    {
      id: 'cover-cables',
      name: 'Cover Cables',
      price: 20,
      image: '/lovable-uploads/27ce8bb9-eb88-4dd3-bd04-4525238f4f77.png',
      description: 'Clean cable management with decorative covers'
    },
    {
      id: 'simple-concealment',
      name: 'Simple Cable Concealment',
      price: 40,
      image: '/lovable-uploads/cf56b4f9-cc16-4662-ba09-6186268ae1a0.png',
      description: 'Basic in-wall cable concealment'
    },
    {
      id: 'fire-safe-concealment',
      name: 'Fire Safe Concealment',
      price: 80,
      image: '/lovable-uploads/9b4cf239-a12b-4275-9ca2-a4abafb59c40.png',
      description: 'Fire-rated in-wall cable concealment system'
    },
    {
      id: 'move-outlet',
      name: 'Move Outlet',
      price: 160,
      image: '/lovable-uploads/a5b8dff7-04c1-4590-a491-0d8a7f9d004c.png',
      description: 'Relocate electrical outlet behind TV'
    },
    {
      id: 'full-motion-mount',
      name: 'Full Motion Mount',
      price: 80,
      image: '/lovable-uploads/1cdefbf0-13c5-4f66-bb5c-761861d66f74.png',
      description: 'Articulating mount for maximum flexibility'
    }
  ];

  const handleServiceClick = (service: any) => {
    if (service.id === 'tv-mounting') {
      setIsTvMountingModalOpen(true);
    } else {
      onAddToCart({
        id: service.id,
        name: service.name,
        price: service.price,
        quantity: 1
      });
    }
  };

  return (
    <section className="py-16 bg-slate-800/50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Our Services
          </h2>
          <p className="text-xl text-slate-300 max-w-2xl mx-auto">
            Professional installation services to transform your space
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map((service) => (
            <ServiceCard
              key={service.id}
              service={service}
              onClick={() => handleServiceClick(service)}
            />
          ))}
        </div>
      </div>
      
      {isTvMountingModalOpen && (
        <TvMountingModal
          onClose={() => setIsTvMountingModalOpen(false)}
          onSubmit={onAddToCart}
        />
      )}
    </section>
  );
};
