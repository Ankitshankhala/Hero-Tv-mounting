
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Settings, Edit, Trash2, Plus, Clock, DollarSign } from 'lucide-react';
import { ServiceModal } from './ServiceModal';
import { DeleteServiceModal } from './DeleteServiceModal';
import { useServicesData, Service } from '@/hooks/useServicesData';

export const ServicesManager = () => {
  const { services, loading, addService, updateService, deleteService } = useServicesData();
  const [searchTerm, setSearchTerm] = useState('');
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const filteredServices = services.filter(service =>
    service.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (service.description && service.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

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

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(price);
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    }
    return `${mins}m`;
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
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center space-x-2 text-xl">
            <Settings className="h-6 w-6 text-blue-600" />
            <span>Services Management</span>
          </CardTitle>
          <p className="text-gray-600">Manage your service offerings and pricing</p>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <Input
              placeholder="Search services..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-md"
            />
            <Button 
              onClick={handleAddService}
              className="bg-green-600 hover:bg-green-700 text-white shadow-lg rounded-lg px-6 py-2 flex items-center space-x-2"
            >
              <Plus className="h-4 w-4" />
              <span>Add New Service</span>
            </Button>
          </div>

          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50 hover:bg-gray-50">
                  <TableHead className="font-semibold">Service Name</TableHead>
                  <TableHead className="font-semibold">Description</TableHead>
                  <TableHead className="font-semibold">Price</TableHead>
                  <TableHead className="font-semibold">Duration</TableHead>
                  <TableHead className="font-semibold text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredServices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                      {searchTerm ? 'No services found matching your search.' : 'No services available. Add your first service to get started.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredServices.map((service) => (
                    <TableRow 
                      key={service.id} 
                      className="hover:bg-blue-50 transition-colors duration-200"
                    >
                      <TableCell className="font-medium text-gray-900">
                        {service.name}
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <p className="text-sm text-gray-600 truncate">
                          {service.description || 'No description provided'}
                        </p>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-1">
                          <DollarSign className="h-4 w-4 text-green-600" />
                          <span className="text-green-600 font-semibold">
                            {formatPrice(service.base_price)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-1">
                          <Clock className="h-4 w-4 text-blue-600" />
                          <span className="text-blue-600 font-medium">
                            {formatDuration(service.duration_minutes)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-center space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditService(service)}
                            className="hover:bg-blue-100 hover:border-blue-300"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteService(service)}
                            className="hover:bg-red-100 hover:border-red-300 text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Stats Card */}
          <Card className="mt-6 bg-gradient-to-r from-purple-50 to-pink-50 border-0">
            <CardHeader>
              <CardTitle className="text-lg text-purple-900">Service Statistics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div className="text-center p-4 bg-white rounded-lg shadow-sm">
                  <h4 className="font-bold text-2xl text-blue-600">{services.length}</h4>
                  <p className="text-gray-600">Total Services</p>
                </div>
                <div className="text-center p-4 bg-white rounded-lg shadow-sm">
                  <h4 className="font-bold text-2xl text-green-600">
                    {formatPrice(services.reduce((avg, service) => avg + service.base_price, 0) / services.length || 0)}
                  </h4>
                  <p className="text-gray-600">Average Price</p>
                </div>
                <div className="text-center p-4 bg-white rounded-lg shadow-sm">
                  <h4 className="font-bold text-2xl text-purple-600">
                    {formatDuration(services.reduce((avg, service) => avg + service.duration_minutes, 0) / services.length || 0)}
                  </h4>
                  <p className="text-gray-600">Average Duration</p>
                </div>
              </div>
            </CardContent>
          </Card>
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
