
import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { ServiceModal } from './ServiceModal';
import { DeleteServiceModal } from './DeleteServiceModal';
import { useServicesData, Service } from '@/hooks/useServicesData';
import { ServicesHeader } from './services/ServicesHeader';
import { ServicesSearch } from './services/ServicesSearch';
import { ServicesTable } from './services/ServicesTable';
import { ServicesStats } from './services/ServicesStats';

export const ServicesManager = () => {
  const { services, loading, addService, updateService, deleteService, reorderServices } = useServicesData();
  const [searchTerm, setSearchTerm] = useState('');
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleAddService = () => {
    setSelectedService(null);
    setShowServiceModal(true);
  };

  const handleEditService = (service: Service) => {
    setSelectedService(service);
    setShowServiceModal(true);
  };

  const handleDeleteService = (service: Service) => {
    setSelectedService(service);
    setShowDeleteModal(true);
  };

  const handleServiceSubmit = async (formData: {
    name: string;
    description: string;
    base_price: number;
    duration_minutes: number;
    image_url?: string | null;
  }) => {
    if (selectedService) {
      await updateService(selectedService.id, formData);
    } else {
      await addService(formData);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!selectedService) return;
    
    setIsDeleting(true);
    try {
      await deleteService(selectedService.id);
      setShowDeleteModal(false);
      setSelectedService(null);
    } finally {
      setIsDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="shadow-lg rounded-xl border-0 bg-gradient-to-r from-blue-50 to-indigo-50">
        <ServicesHeader />
        <CardContent>
          <ServicesSearch
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            onAddService={handleAddService}
          />

          <ServicesTable
            services={services}
            searchTerm={searchTerm}
            onEdit={handleEditService}
            onDelete={handleDeleteService}
            onReorder={reorderServices}
          />

          <ServicesStats services={services} />
        </CardContent>
      </Card>

      <ServiceModal
        isOpen={showServiceModal}
        onClose={() => setShowServiceModal(false)}
        onSubmit={handleServiceSubmit}
        service={selectedService}
        title={selectedService ? 'Edit Service' : 'Add New Service'}
      />

      <DeleteServiceModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDeleteConfirm}
        service={selectedService}
        isDeleting={isDeleting}
      />
    </div>
  );
};
