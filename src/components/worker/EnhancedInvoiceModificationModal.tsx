import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { ServiceConfigurationTab } from './invoice/ServiceConfigurationTab';
import { AddServicesTab } from './invoice/AddServicesTab';
import { TvMountingConfigurationModal } from './invoice/TvMountingConfigurationModal';
import { ModificationSummary } from './invoice/ModificationSummary';
import { RealTimePriceDisplay } from './invoice/RealTimePriceDisplay';
import { Loader2 } from 'lucide-react';

interface BookingService {
  id: string;
  service_id: string;
  service_name: string;
  base_price: number;
  quantity: number;
  configuration: any;
}

interface EnhancedInvoiceModificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  job: any;
  onModificationCreated: () => void;
}

export const EnhancedInvoiceModificationModal = ({ 
  isOpen, 
  onClose, 
  job, 
  onModificationCreated 
}: EnhancedInvoiceModificationModalProps) => {
  const [services, setServices] = useState<BookingService[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showTvModal, setShowTvModal] = useState(false);
  const [totalPrice, setTotalPrice] = useState(0);
  const [originalPrice, setOriginalPrice] = useState(0);
  const { toast } = useToast();

  // Fetch booking services
  useEffect(() => {
    if (isOpen && job?.id) {
      fetchBookingServices();
    }
  }, [isOpen, job?.id]);

  // Real-time subscription for booking services
  useEffect(() => {
    if (!isOpen || !job?.id) return;

    const channel = supabase
      .channel('booking-services-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'booking_services',
          filter: `booking_id=eq.${job.id}`
        },
        () => {
          fetchBookingServices();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isOpen, job?.id]);

  // Calculate total price with useMemo for better performance
  const currentTotalPrice = useMemo(() => {
    return services.reduce((sum, service) => {
      const servicePrice = calculateServicePrice(service);
      return sum + (servicePrice * service.quantity);
    }, 0);
  }, [services]);

  // Update total price when calculated value changes
  useEffect(() => {
    setTotalPrice(currentTotalPrice);
  }, [currentTotalPrice]);

  // Calculate difference with useMemo
  const priceDifference = useMemo(() => {
    return currentTotalPrice - originalPrice;
  }, [currentTotalPrice, originalPrice]);

  const fetchBookingServices = async () => {
    if (!job?.id) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('booking_services')
        .select('*')
        .eq('booking_id', job.id)
        .order('created_at');

      if (error) throw error;

      if (data && data.length > 0) {
        setServices(data);
        // Only set original price if it hasn't been set yet
        if (originalPrice === 0) {
          const original = data.reduce((sum, service) => {
            const servicePrice = calculateServicePrice(service);
            return sum + (servicePrice * service.quantity);
          }, 0);
          setOriginalPrice(original);
        }
      } else {
        // Migrate from legacy single service
        await migrateLegacyService();
      }
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
  };

  const migrateLegacyService = async () => {
    if (!job?.service_id) return;

    try {
      // Get service details
      const { data: serviceData, error: serviceError } = await supabase
        .from('services')
        .select('*')
        .eq('id', job.service_id)
        .single();

      if (serviceError) throw serviceError;

      // Create booking service entry
      const bookingService = {
        booking_id: job.id,
        service_id: job.service_id,
        service_name: serviceData.name,
        base_price: serviceData.base_price,
        quantity: 1,
        configuration: {}
      };

      const { data, error } = await supabase
        .from('booking_services')
        .insert(bookingService)
        .select()
        .single();

      if (error) throw error;

      setServices([data]);
      setOriginalPrice(serviceData.base_price);
    } catch (error) {
      console.error('Error migrating legacy service:', error);
    }
  };

  const calculateServicePrice = (service: BookingService) => {
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
  };

  const updateServiceQuantity = async (serviceId: string, newQuantity: number) => {
    if (newQuantity < 0) return;

    try {
      const { error } = await supabase
        .from('booking_services')
        .update({ quantity: newQuantity })
        .eq('id', serviceId);

      if (error) throw error;

      setServices(prev => prev.map(service => 
        service.id === serviceId 
          ? { ...service, quantity: newQuantity }
          : service
      ));
    } catch (error) {
      console.error('Error updating service quantity:', error);
      toast({
        title: "Error",
        description: "Failed to update service quantity",
        variant: "destructive",
      });
    }
  };

  const updateServiceConfiguration = async (serviceId: string, newConfig: any) => {
    try {
      const { error } = await supabase
        .from('booking_services')
        .update({ configuration: newConfig })
        .eq('id', serviceId);

      if (error) throw error;

      setServices(prev => prev.map(service => 
        service.id === serviceId 
          ? { ...service, configuration: newConfig }
          : service
      ));
    } catch (error) {
      console.error('Error updating service configuration:', error);
      toast({
        title: "Error",
        description: "Failed to update service configuration",
        variant: "destructive",
      });
    }
  };

  const removeService = async (serviceId: string) => {
    try {
      const { error } = await supabase
        .from('booking_services')
        .delete()
        .eq('id', serviceId);

      if (error) throw error;

      setServices(prev => prev.filter(service => service.id !== serviceId));
    } catch (error) {
      console.error('Error removing service:', error);
      toast({
        title: "Error",
        description: "Failed to remove service",
        variant: "destructive",
      });
    }
  };

  const addNewService = async (newService: any) => {
    try {
      const bookingService = {
        booking_id: job.id,
        service_id: newService.id,
        service_name: newService.name,
        base_price: newService.base_price,
        quantity: newService.quantity,
        configuration: newService.configuration || {}
      };

      const { data, error } = await supabase
        .from('booking_services')
        .insert(bookingService)
        .select()
        .single();

      if (error) throw error;

      setServices(prev => [...prev, data]);
      
      toast({
        title: "Service Added",
        description: `${newService.name} added to booking`,
      });
    } catch (error) {
      console.error('Error adding service:', error);
      toast({
        title: "Error",
        description: "Failed to add service",
        variant: "destructive",
      });
    }
  };

  const handleTvMountingConfiguration = (serviceId: string) => {
    setShowTvModal(true);
  };

  const handleTvMountingComplete = async (configuration: any) => {
    try {
      // Find TV mounting service and update its configuration
      const tvService = services.find(s => s.service_name === 'TV Mounting');
      if (tvService) {
        await updateServiceConfiguration(tvService.id, configuration);
      }
      setShowTvModal(false);
    } catch (error) {
      console.error('Error updating TV mounting configuration:', error);
    }
  };

  const handleSubmitModification = async () => {
    setSaving(true);
    try {
      const difference = currentTotalPrice - originalPrice;

      // Update booking with new pending payment amount
      const { error: updateError } = await supabase
        .from('bookings')
        .update({ 
          pending_payment_amount: difference,
          has_modifications: true 
        })
        .eq('id', job.id);

      if (updateError) throw updateError;

      // Log the modification
      const { error: logError } = await supabase
        .from('invoice_service_modifications')
        .insert({
          booking_id: job.id,
          worker_id: job.worker_id,
          modification_type: 'modify',
          service_name: 'Multiple Services',
          price_change: difference
        });

      if (logError) console.error('Error logging modification:', logError);

      toast({
        title: "Success",
        description: `Invoice modified successfully. ${difference >= 0 ? 'Additional' : 'Refund'} amount: $${Math.abs(difference).toFixed(2)}`,
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
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-6xl bg-slate-800 border-slate-700">
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-white" />
            <span className="ml-2 text-white">Loading services...</span>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-6xl bg-slate-800 border-slate-700 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">
              Enhanced Invoice Modification - Job #{job?.id?.slice(0, 8)}
            </DialogTitle>
          </DialogHeader>

          <RealTimePriceDisplay
            originalPrice={originalPrice}
            currentPrice={currentTotalPrice}
            difference={priceDifference}
          />

          <Tabs defaultValue="configure" className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-slate-700">
              <TabsTrigger value="configure" className="text-white data-[state=active]:bg-slate-600">
                Configure Services
              </TabsTrigger>
              <TabsTrigger value="add" className="text-white data-[state=active]:bg-slate-600">
                Add New Services
              </TabsTrigger>
            </TabsList>

            <TabsContent value="configure" className="space-y-6">
              <ServiceConfigurationTab
                services={services}
                onUpdateQuantity={updateServiceQuantity}
                onUpdateConfiguration={updateServiceConfiguration}
                onRemoveService={removeService}
                onTvMountingConfiguration={handleTvMountingConfiguration}
                calculateServicePrice={calculateServicePrice}
              />
            </TabsContent>

            <TabsContent value="add" className="space-y-6">
              <AddServicesTab onAddService={addNewService} />
            </TabsContent>
          </Tabs>

          <ModificationSummary
            originalTotal={originalPrice}
            newTotal={currentTotalPrice}
          />

          <div className="flex justify-end space-x-4 pt-4 border-t border-slate-700">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={saving}
              className="border-border text-foreground hover:bg-accent hover:text-accent-foreground"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmitModification}
              disabled={saving || services.length === 0}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Apply Modifications'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <TvMountingConfigurationModal
        isOpen={showTvModal}
        onClose={() => setShowTvModal(false)}
        onConfigurationComplete={handleTvMountingComplete}
        existingConfiguration={services.find(s => s.service_name === 'TV Mounting')?.configuration}
      />
    </>
  );
};