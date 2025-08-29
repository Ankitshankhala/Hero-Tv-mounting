import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
import { InvoiceModificationPayment } from './invoice/InvoiceModificationPayment';
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
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [totalPrice, setTotalPrice] = useState(0);
  const [originalPrice, setOriginalPrice] = useState(0);
  const { toast } = useToast();

  // Define calculateServicePrice function with useCallback
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

  const migrateLegacyService = useCallback(async () => {
    if (!job?.service_id) return;

    try {
      console.log('Migrating legacy service for job:', job.id, 'service:', job.service_id);
      
      // Get service details
      const { data: serviceData, error: serviceError } = await supabase
        .from('services')
        .select('*')
        .eq('id', job.service_id)
        .single();

      if (serviceError) {
        console.error('Error fetching service data:', serviceError);
        throw serviceError;
      }

      console.log('Service data retrieved:', serviceData);

      // Create booking service entry
      const bookingService = {
        booking_id: job.id,
        service_id: job.service_id,
        service_name: serviceData.name,
        base_price: serviceData.base_price || 0,
        quantity: 1,
        configuration: {}
      };

      console.log('Creating booking service:', bookingService);

      const { data, error } = await supabase
        .from('booking_services')
        .insert(bookingService)
        .select()
        .single();

      if (error) {
        console.error('Error inserting booking service:', error);
        throw error;
      }

      console.log('Booking service created:', data);

      setServices([data]);
      setOriginalPrice(serviceData.base_price || 0);
      
      toast({
        title: "Service Migrated",
        description: "Legacy service data has been migrated to the new format",
      });
    } catch (error) {
      console.error('Error migrating legacy service:', error);
      toast({
        title: "Migration Error",
        description: "Failed to migrate legacy service data",
        variant: "destructive",
      });
    }
  }, [job?.service_id, job?.id, toast]);

  const fetchBookingServices = useCallback(async () => {
    if (!job?.id) return;

    console.log('Fetching booking services for job:', job.id);
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

      console.log('Fetched booking services:', data);

      if (data && data.length > 0) {
        setServices(data);
        // Only set original price if it hasn't been set yet
        if (originalPrice === 0) {
          const original = data.reduce((sum, service) => {
            const servicePrice = calculateServicePrice(service);
            return sum + (servicePrice * service.quantity);
          }, 0);
          console.log('Calculated original price:', original);
          setOriginalPrice(original);
        }
      } else {
        console.log('No booking services found, migrating legacy service');
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
  }, [job?.id, originalPrice, calculateServicePrice, migrateLegacyService, toast]);

  // Calculate total price with useMemo for better performance
  const currentTotalPrice = useMemo(() => {
    return services.reduce((sum, service) => {
      const servicePrice = calculateServicePrice(service);
      return sum + (servicePrice * service.quantity);
    }, 0);
  }, [services, calculateServicePrice]);

  // Update total price when calculated value changes
  useEffect(() => {
    setTotalPrice(currentTotalPrice);
  }, [currentTotalPrice]);

  // Calculate difference with useMemo
  const priceDifference = useMemo(() => {
    return currentTotalPrice - originalPrice;
  }, [currentTotalPrice, originalPrice]);

  // Fetch booking services effect
  useEffect(() => {
    if (isOpen && job?.id) {
      fetchBookingServices();
    }
  }, [isOpen, job?.id, fetchBookingServices]);

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
  }, [isOpen, job?.id, fetchBookingServices]);

  const updateServiceQuantity = async (serviceId: string, newQuantity: number) => {
    if (newQuantity < 0) return;

    console.log('Updating service quantity:', serviceId, 'to:', newQuantity);

    try {
      const { error } = await supabase
        .from('booking_services')
        .update({ quantity: newQuantity })
        .eq('id', serviceId);

      if (error) {
        console.error('Error updating quantity:', error);
        throw error;
      }

      setServices(prev => prev.map(service => 
        service.id === serviceId 
          ? { ...service, quantity: newQuantity }
          : service
      ));

      toast({
        title: "Quantity Updated",
        description: `Service quantity updated to ${newQuantity}`,
      });
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

      // If there's a positive difference (additional charges), try card-on-file first
      if (difference > 0) {
        // Check if customer has saved payment method
        const hasCardOnFile = job.customer?.has_saved_card && job.customer?.stripe_default_payment_method_id;
        
        if (hasCardOnFile) {
          console.log('Customer has card on file, attempting automatic charge...');
          try {
            // Attempt automatic charge with card-on-file
            const { data: paymentData, error: paymentError } = await supabase.functions.invoke('process-invoice-modification-payment', {
              body: {
                bookingId: job.id,
                useCardOnFile: true
              }
            });

            if (paymentError) throw paymentError;

            if (paymentData?.success && paymentData?.used_card_on_file) {
              // Successful card-on-file payment
              toast({
                title: "Payment Successful",
                description: `Successfully charged $${difference.toFixed(2)} using saved payment method`,
              });

              // Trigger invoice update
              try {
                await supabase.functions.invoke('update-invoice', {
                  body: {
                    booking_id: job.id,
                    send_email: true
                  }
                });
              } catch (invoiceError) {
                console.error('Invoice update failed:', invoiceError);
              }

              onModificationCreated();
              onClose();
              return;
            } else {
              // Card-on-file failed, fall back to payment modal
              console.log('Card-on-file payment failed, showing payment modal...');
            }
          } catch (cofError) {
            console.error('Card-on-file payment error:', cofError);
            // Continue to payment modal as fallback
          }
        }

        // Show payment modal as fallback or if no card-on-file
        toast({
          title: "Success", 
          description: `Invoice modified successfully. Additional amount: $${difference.toFixed(2)}`,
        });
        setShowPaymentModal(true);
      } else {
        // No additional payment needed
        toast({
          title: "Success",
          description: difference < 0 ? `Invoice modified successfully. Refund amount: $${Math.abs(difference).toFixed(2)}` : "Invoice modified successfully",
        });
        onModificationCreated();
        onClose();
      }
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

  const handlePaymentComplete = () => {
    onModificationCreated();
    onClose();
  };

  if (loading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-6xl bg-slate-800 border-slate-700">
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
        <DialogContent className="max-w-6xl bg-slate-800 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white">
              Invoice Modification - Job #{job?.id?.slice(0, 8)}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center p-8 text-white">
            <p className="text-lg mb-4">No services found for this booking</p>
            <p className="text-sm text-slate-400 mb-4">
              This might be due to a data migration issue. 
            </p>
            <Button 
              onClick={migrateLegacyService}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Try to Migrate Legacy Data
            </Button>
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

      <InvoiceModificationPayment
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        job={job}
        pendingAmount={priceDifference}
        onPaymentComplete={handlePaymentComplete}
      />
    </>
  );
};