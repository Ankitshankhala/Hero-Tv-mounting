
import React, { useState } from 'react';
import { ServiceCard } from './ServiceCard';
import { TvMountingModal } from './TvMountingModal';
import { CartItem } from '@/pages/Index';
import { useServicesData } from '@/hooks/useServicesData';
import { Loader2 } from 'lucide-react';

interface ServicesSectionProps {
  onAddToCart: (item: CartItem) => void;
}

export const ServicesSection: React.FC<ServicesSectionProps> = ({ onAddToCart }) => {
  const [isTvMountingModalOpen, setIsTvMountingModalOpen] = useState(false);
  const { services, loading } = useServicesData();

  // Filter out add-on services that should be handled through the TV Mounting modal
  const mainServices = services.filter(service => 
    !service.name.includes('Add-on') && 
    !service.name.includes('Over 65"') &&
    !service.name.includes('Stone/Brick/Tile')
  );

  const handleServiceClick = (service: any) => {
    if (service.name === 'TV Mounting') {
      setIsTvMountingModalOpen(true);
    } else {
      onAddToCart({
        id: service.id,
        name: service.name,
        price: service.base_price,
        quantity: 1
      });
    }
  };

  if (loading) {
    return (
      <section className="py-16 bg-slate-800/50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Services
            </h2>
          </div>
          <div className="flex justify-center items-center min-h-[200px]">
            <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-16 bg-slate-800/50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Services
          </h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {mainServices.map((service) => (
            <ServiceCard
              key={service.id}
              id={service.id}
              name={service.name}
              price={service.base_price}
              image={getServiceImage(service.name)}
              description={service.description || ''}
              onAddToCart={() => handleServiceClick(service)}
            />
          ))}
        </div>
      </div>
      
      {isTvMountingModalOpen && (
        <TvMountingModal
          onClose={() => setIsTvMountingModalOpen(false)}
          onAddToCart={onAddToCart}
          services={services}
        />
      )}
    </section>
  );
};

// Helper function to map service names to their corresponding images
const getServiceImage = (serviceName: string): string => {
  const imageMap: { [key: string]: string } = {
    'TV Mounting': '/lovable-uploads/d6a6d8ff-7ee8-45a6-bd82-6aa3aab9844a.png',
    'Full Motion Mount': '/lovable-uploads/77f65da7-38bc-4d01-afdd-bb998049c77b.png',
    'Flat Mount': '/lovable-uploads/3c8ed729-7438-43d2-88ad-328ac45775e1.png',
    'Cover Cables': '/lovable-uploads/01571029-7b6a-4df2-9c0f-1c0b120fedff.png',
    'Simple Cable Concealment': '/lovable-uploads/f430204b-2ef5-4727-b3ee-7f4d9d26ded4.png',
    'Fire Safe Cable Concealment': '/lovable-uploads/71fa4731-cb99-42cb-bfd0-29236a1bc91a.png',
    'General Mounting': '/lovable-uploads/4cc7c28c-dd34-4b03-82ef-6b8280bc616f.png',
    'Furniture Assembly': '/lovable-uploads/15729bed-70cc-4a81-afe5-f295b900175d.png',
    'Hire Second Technician': '/lovable-uploads/9ffb6618-666e-44a7-a41b-bb031fd291b9.png'
  };
  
  return imageMap[serviceName] || '/lovable-uploads/d6a6d8ff-7ee8-45a6-bd82-6aa3aab9844a.png';
};

export default ServicesSection;
