import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { ServiceConfigurationTab } from './invoice/ServiceConfigurationTab';
import { Loader2 } from 'lucide-react';

interface BookingService {
  id: string;
  service_id: string;
  service_name: string;
  base_price: number;
  quantity: number;
  configuration: any;
}

interface RemoveServicesModalProps {
  isOpen: boolean;
  onClose: () => void;
  job: any;
  onModificationCreated: () => void;
}

export const RemoveServicesModal = ({ 
  isOpen, 
  onClose, 
  job, 
  onModificationCreated 
}: RemoveServicesModalProps) => {
  const [services, setServices] = useState<BookingService[]>([]);
  const [loading, setLoading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const { toast } = useToast();

  // Define calculateServicePrice function
  const calculateServicePrice = useCallback((service: BookingService) => {
    let price = service.base_price;
    const config = service.configuration || {};

    // TV Mounting specific pricing
    if (service.service_name === 'TV Mounting') {
      if (config.over65) price += 50;
      if (config.frameMount) price += 75;
      if (config.wallType === 'stone' || config.wallType === 'brick' || config.wallType === 'tile') {
        price += 100;
      }
      if (config.soundbar) price += 30;
    }

    return price;
  }, []);

  const fetchBookingServices = useCallback(async () => {
    if (!job?.id) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('booking_services')
        .select('*')
        .eq('booking_id', job.id)
        .order('created_at');

      if (error) {
        console.error('Error fetching booking services:', error);
        throw error;
      }

      setServices(data || []);
    } catch (error) {
      console.error('Error fetching booking services:', error);
      toast({
        title: "Error",
        description: "Failed to load booking services",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [job?.id, toast]);

  // Fetch booking services when modal opens
  useEffect(() => {
    if (isOpen && job?.id) {
      fetchBookingServices();
    }
  }, [isOpen, job?.id, fetchBookingServices]);

  const removeService = async (serviceId: string) => {
    setRemoving(true);
    try {
      const { data, error } = await supabase.functions.invoke('worker-remove-services', {
        body: {
          booking_id: job.id,
          service_ids: [serviceId]
        }
      });

      if (error) {
        console.error('Error removing service:', error);
        throw error;
      }

      if (!data.success) {
        throw new Error(data.error || 'Failed to remove service');
      }

      // Update local state
      setServices(prev => prev.filter(service => service.id !== serviceId));

      toast({
        title: "Service Removed",
        description: `Service removed successfully. ${data.refund_amount > 0 ? `Refund of $${data.refund_amount.toFixed(2)} processed.` : ''}`,
      });

      // If this was the last service, close modal and refresh
      if (services.length === 1) {
        onModificationCreated();
        onClose();
      }
    } catch (error) {
      console.error('Error removing service:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to remove service",
        variant: "destructive",
      });
    } finally {
      setRemoving(false);
    }
  };

  if (loading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl bg-slate-800 border-slate-700">
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-white" />
            <span className="ml-2 text-white">Loading booking services...</span>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (services.length === 0 && !loading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl bg-slate-800 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white">
              Remove Services - Job #{job?.id?.slice(0, 8)}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center p-8 text-white">
            <p className="text-lg mb-4">No services found for this booking</p>
            <Button 
              onClick={onClose}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl bg-slate-800 border-slate-700 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white">
            Remove Services - Job #{job?.id?.slice(0, 8)}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <ServiceConfigurationTab
            services={services}
            onUpdateQuantity={() => {}} // Not used in remove-only mode
            onUpdateConfiguration={() => {}} // Not used in remove-only mode
            onRemoveService={removeService}
            onTvMountingConfiguration={() => {}} // Not used in remove-only mode
            calculateServicePrice={calculateServicePrice}
            removeOnly={true}
          />
        </div>

        <div className="flex justify-end space-x-4 pt-4 border-t border-slate-700">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={removing}
            className="border-border text-foreground hover:bg-accent hover:text-accent-foreground"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};