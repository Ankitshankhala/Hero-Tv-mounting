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
      price: 90,
      image: '/lovable-uploads/d6a6d8ff-7ee8-45a6-bd82-6aa3aab9844a.png',
      description: 'Professional TV wall mounting with perfect positioning'
    },
    {
      id: 'full-motion-mount',
      name: 'Full Motion Mount',
      price: 80,
      image: '/lovable-uploads/77f65da7-38bc-4d01-afdd-bb998049c77b.png',
      description: 'Articulating mount for maximum flexibility'
    },
    {
      id: 'flat-mount',
      name: 'Flat Mount',
      price: 50,
      image: '/lovable-uploads/3c8ed729-7438-43d2-88ad-328ac45775e1.png',
      description: 'Low-profile flat wall mount'
    },
    {
      id: 'cover-cables',
      name: 'Cover Cables',
      price: 20,
      image: '/lovable-uploads/01571029-7b6a-4df2-9c0f-1c0b120fedff.png',
      description: 'Clean cable management with decorative covers'
    },
    {
      id: 'simple-concealment',
      name: 'Simple Cable Concealment',
      price: 50,
      image: '/lovable-uploads/30e56e23-dec2-4e93-a794-d7575b2e1bd5.png',
      description: 'Basic in-wall cable concealment'
    },
    {
      id: 'fire-safe-concealment',
      name: 'Fire Safe Cable Concealment',
      price: 100,
      image: '/lovable-uploads/71fa4731-cb99-42cb-bfd0-29236a1bc91a.png',
      description: 'Fire-rated in-wall cable concealment system'
    },
    {
      id: 'general-mounting',
      name: 'General Mounting',
      price: 75,
      image: '/lovable-uploads/6889f051-f5b1-4f2a-a093-a09693378bd4.png',
      description: 'General mounting services per hour'
    },
    {
      id: 'furniture-assembly',
      name: 'Furniture Assembly',
      price: 50,
      image: '/lovable-uploads/d6a6d8ff-7ee8-45a6-bd82-6aa3aab9844a.png',
      description: 'Professional furniture assembly per hour'
    },
    {
      id: 'hire-second-technician',
      name: 'Hire Second Technician',
      price: 65,
      image: '/lovable-uploads/9ffb6618-666e-44a7-a41b-bb031fd291b9.png',
      description: 'Additional technician for complex installations'
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
            Services
          </h2>
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
          onAddToCart={onAddToCart}
        />
      )}
    </section>
  );
};
