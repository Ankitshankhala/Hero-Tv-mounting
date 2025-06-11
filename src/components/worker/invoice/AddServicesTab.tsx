
import React from 'react';
import { ServicesSection } from '@/components/ServicesSection';

interface AddServicesTabProps {
  onAddService: (service: any) => void;
}

export const AddServicesTab: React.FC<AddServicesTabProps> = ({
  onAddService
}) => {
  return (
    <div className="bg-slate-900/50 rounded-lg p-4">
      <h3 className="text-white text-lg font-semibold mb-4">Add Services to Booking</h3>
      <ServicesSection onAddToCart={onAddService} />
    </div>
  );
};
