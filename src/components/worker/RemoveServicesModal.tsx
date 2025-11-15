import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { ServiceConfigurationTab } from './invoice/ServiceConfigurationTab';
import { ModificationSummary } from './invoice/ModificationSummary';
import { calculateServiceLinePrice, calculateBookingTotal } from '@/utils/pricing';
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
  const [originalServices, setOriginalServices] = useState<BookingService[]>([]);
  const [loading, setLoading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const { toast } = useToast();

  // Calculate totals using the pricing utility
  const originalTotal = useMemo(() => {
    return calculateBookingTotal(originalServices);
  }, [originalServices]);

  const newTotal = useMemo(() => {
    return calculateBookingTotal(services);
  }, [services]);

  // Use shared pricing utility with defensive safeguards
  const calculateServicePrice = useCallback((service: BookingService) => {
    const price = calculateServiceLinePrice({
      service_name: service.service_name,
      base_price: Number(service.base_price) || 0, // Ensure number
      quantity: Number(service.quantity) || 1,
      configuration: service.configuration
    });
    
    console.log(`Price for ${service.service_name}:`, {
      base_price: service.base_price,
      calculated_price: price,
      quantity: service.quantity
    }); // Debug logging
    
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

      const rows = data || [];

      // Fallback: fetch base prices from services table when missing/zero
      const missingPriceIds = rows
        .filter((s: any) => !s.base_price || Number(s.base_price) <= 0)
        .map((s: any) => s.service_id)
        .filter(Boolean);

      let servicePriceMap = new Map<string, number>();
      if (missingPriceIds.length > 0) {
        const { data: svcData, error: svcError } = await supabase
          .from('services')
          .select('id, base_price')
          .in('id', missingPriceIds);

        if (svcError) {
          console.warn('Failed to fetch fallback service prices:', svcError);
        } else {
          (svcData || []).forEach((svc: any) => {
            servicePriceMap.set(svc.id, Number(svc.base_price) || 0);
          });
        }
      }

      // Normalize data - ensure numeric base_price & quantity, apply fallback when needed
      const normalizedData = rows.map((service: any) => {
        const fallback = servicePriceMap.get(service.service_id) ?? 0;
        return {
          ...service,
          base_price: Number(service.base_price) || fallback || 0,
          quantity: Number(service.quantity) || 1,
        } as BookingService;
      });

      console.log('Normalized booking services (with fallbacks):', normalizedData);

      setServices(normalizedData);
      setOriginalServices(normalizedData); // Store original services for price comparison
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
    const serviceToRemove = services.find(s => s.id === serviceId);
    if (!serviceToRemove) return;

    setRemoving(true);
    
    // Store original state for rollback
    const originalServices = [...services];
    
    // Optimistic update
    const remainingServices = services.filter(service => service.id !== serviceId);
    setServices(remainingServices);

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

      toast({
        title: "Service Removed",
        description: `${serviceToRemove.service_name} removed successfully. ${data.refund_amount > 0 ? `Refund of $${data.refund_amount.toFixed(2)} processed.` : ''}`,
      });

      // Check if this was the last service using the filtered array
      if (remainingServices.length === 0) {
        onModificationCreated();
        onClose();
      }
    } catch (error) {
      console.error('Error removing service:', error);
      
      // Rollback optimistic update on error
      setServices(originalServices);
      
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
          {originalServices.length > 0 && (
            <ModificationSummary
              originalTotal={originalTotal}
              newTotal={newTotal}
            />
          )}
          
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