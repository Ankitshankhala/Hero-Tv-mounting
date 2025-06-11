
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { ServiceModificationTab } from './invoice/ServiceModificationTab';
import { AddServicesTab } from './invoice/AddServicesTab';
import { ModificationSummary } from './invoice/ModificationSummary';
import { ModificationForm } from './invoice/ModificationForm';
import { AlertTriangle, Info } from 'lucide-react';

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
          customer_approved: false,
          approval_status: 'pending'
        });

      if (modError) throw modError;

      const { error: bookingError } = await supabase
        .from('bookings')
        .update({ 
          has_modifications: true,
        })
        .eq('id', job.id);

      if (bookingError) throw bookingError;

      toast({
        title: "Success",
        description: "Invoice modification created and customer notified",
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
  const hasChanges = JSON.stringify(services) !== JSON.stringify(job?.services || []);
  const priceDifference = newTotal - originalTotal;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl bg-slate-800 border-slate-700 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center space-x-2">
            <span>Modify Invoice - Job #{job?.id?.slice(0, 8)}</span>
            {job?.has_modifications && (
              <Badge variant="outline" className="text-yellow-400 border-yellow-400">
                Previously Modified
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* Information Alert */}
        <Alert className="bg-blue-900/20 border-blue-700">
          <Info className="h-4 w-4" />
          <AlertDescription className="text-blue-200">
            Any changes made will be sent to the customer for approval before taking effect.
          </AlertDescription>
        </Alert>

        {/* Price Impact Warning */}
        {hasChanges && priceDifference !== 0 && (
          <Alert className={`${priceDifference > 0 ? 'bg-orange-900/20 border-orange-700' : 'bg-green-900/20 border-green-700'}`}>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className={priceDifference > 0 ? 'text-orange-200' : 'text-green-200'}>
              {priceDifference > 0 
                ? `This modification will increase the total by $${priceDifference.toFixed(2)}. Customer approval will be required.`
                : `This modification will decrease the total by $${Math.abs(priceDifference).toFixed(2)}. A refund may be issued.`
              }
            </AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="modify" className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-slate-700">
            <TabsTrigger value="modify" className="text-white data-[state=active]:bg-slate-600">
              Modify Current Services
              {hasChanges && <Badge variant="outline" className="ml-2">Modified</Badge>}
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
            {services.length > 0 && (
              <ModificationSummary
                originalTotal={originalTotal}
                newTotal={newTotal}
              />
            )}
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
