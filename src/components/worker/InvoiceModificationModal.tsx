
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { ServiceModificationTab } from './invoice/ServiceModificationTab';
import { AddServicesTab } from './invoice/AddServicesTab';
import { ModificationSummary } from './invoice/ModificationSummary';
import { ModificationForm } from './invoice/ModificationForm';

interface Service {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

interface InvoiceModificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  job: any;
  onModificationCreated: () => void;
}

const InvoiceModificationModal = ({ 
  isOpen, 
  onClose, 
  job, 
  onModificationCreated 
}: InvoiceModificationModalProps) => {
  const [services, setServices] = useState<Service[]>(
    Array.isArray(job?.services) ? job.services : []
  );
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const updateServiceQuantity = (serviceId: string, newQuantity: number) => {
    if (newQuantity < 0) return;
    
    setServices(services.map(service => 
      service.id === serviceId 
        ? { ...service, quantity: newQuantity }
        : service
    ));
  };

  const removeService = (serviceId: string) => {
    setServices(services.filter(service => service.id !== serviceId));
  };

  const addNewService = (newService: any) => {
    const existingService = services.find(s => s.id === newService.id);
    
    if (existingService) {
      setServices(services.map(service => 
        service.id === newService.id 
          ? { ...service, quantity: service.quantity + newService.quantity }
          : service
      ));
      toast({
        title: "Service Updated",
        description: `${newService.name} quantity increased`,
      });
    } else {
      setServices([...services, newService]);
      toast({
        title: "Service Added",
        description: `${newService.name} added to booking`,
      });
    }
  };

  const calculateNewTotal = () => {
    return services.reduce((total, service) => total + (service.price * service.quantity), 0);
  };

  const handleSubmitModification = async () => {
    if (!reason.trim()) {
      toast({
        title: "Error",
        description: "Please provide a reason for the modification",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const originalTotal = job.total_price;
      const modifiedTotal = calculateNewTotal();

      const { error: modError } = await supabase
        .from('invoice_modifications')
        .insert({
          booking_id: job.id,
          worker_id: job.worker_id,
          original_services: job.services as any,
          modified_services: services as any,
          original_total: originalTotal,
          modified_total: modifiedTotal,
          modification_reason: reason,
          customer_approved: false
        });

      if (modError) throw modError;

      const { error: bookingError } = await supabase
        .from('bookings')
        .update({ 
          has_modifications: true,
          pending_payment_amount: modifiedTotal - originalTotal
        })
        .eq('id', job.id);

      if (bookingError) throw bookingError;

      toast({
        title: "Success",
        description: "Invoice modification created successfully",
      });

      onModificationCreated();
      onClose();
    } catch (error) {
      console.error('Error creating modification:', error);
      toast({
        title: "Error",
        description: "Failed to create invoice modification",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const originalTotal = job?.total_price || 0;
  const newTotal = calculateNewTotal();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl bg-slate-800 border-slate-700 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white">Modify Invoice - Job #{job?.id?.slice(0, 8)}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="modify" className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-slate-700">
            <TabsTrigger value="modify" className="text-white data-[state=active]:bg-slate-600">
              Modify Current Services
            </TabsTrigger>
            <TabsTrigger value="add" className="text-white data-[state=active]:bg-slate-600">
              Add New Services
            </TabsTrigger>
          </TabsList>

          <TabsContent value="modify" className="space-y-6">
            <ServiceModificationTab
              services={services}
              onUpdateQuantity={updateServiceQuantity}
              onRemoveService={removeService}
            />
            <ModificationSummary
              originalTotal={originalTotal}
              newTotal={newTotal}
            />
          </TabsContent>

          <TabsContent value="add" className="space-y-6">
            <AddServicesTab onAddService={addNewService} />
          </TabsContent>
        </Tabs>

        <ModificationForm
          reason={reason}
          onReasonChange={setReason}
          onSubmit={handleSubmitModification}
          onCancel={onClose}
          loading={loading}
          servicesCount={services.length}
        />
      </DialogContent>
    </Dialog>
  );
};

export default InvoiceModificationModal;
