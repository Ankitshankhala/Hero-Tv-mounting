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
      image: '/lovable-uploads/7eae6461-3b30-4c8e-9e15-43cff058631d.png',
      description: 'Professional TV wall mounting with perfect positioning'
    },
    {
      id: 'full-motion-mount',
      name: 'Full Motion Mount',
      price: 80,
      image: '/lovable-uploads/c24ffe52-556a-4c14-a753-e929c7b1af9a.png',
      description: 'Articulating mount for maximum flexibility'
    },
    {
      id: 'flat-mount',
      name: 'Flat Mount',
      price: 50,
      image: '/lovable-uploads/4a49b814-b16a-4daf-aa91-3a52fcbb5fae.png',
      description: 'Low-profile flat wall mount'
    },
    {
      id: 'cover-cables',
      name: 'Cover Cables',
      price: 20,
      image: '/lovable-uploads/2ca84624-6945-44f1-8cf1-e35c574b9a1f.png',
      description: 'Clean cable management with decorative covers'
    },
    {
      id: 'simple-concealment',
      name: 'Simple Cable Concealment',
      price: 50,
      image: '/lovable-uploads/6a45733b-ecff-4228-9898-90361762b328.png',
      description: 'Basic in-wall cable concealment'
    },
    {
      id: 'fire-safe-concealment',
      name: 'Fire Safe Cable Concealment',
      price: 100,
      image: '/lovable-uploads/32f3fe0e-ce27-4c46-9b87-5c158de79eb9.png',
      description: 'Fire-rated in-wall cable concealment system'
    },
    {
      id: 'general-mounting',
      name: 'General Mounting',
      price: 75,
      image: '/lovable-uploads/ebfd43c9-5c9d-4d15-b395-a22f44063cb6.png',
      description: 'General mounting services per hour'
    },
    {
      id: 'furniture-assembly',
      name: 'Furniture Assembly',
      price: 50,
      image: '/lovable-uploads/b682bcce-b109-42e7-b564-c7ef23dc87a5.png',
      description: 'Professional furniture assembly per hour'
    },
    {
      id: 'hire-second-technician',
      name: 'Hire Second Technician',
      price: 65,
      image: '/lovable-uploads/f35a81e7-8c1d-4ea5-99e9-93fb7b08d6e5.png',
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
          onAddToCart={onAddToCart}
        />
      )}
    </section>
  );
};
