import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { calculateServiceLinePrice, calculateBookingTotal } from '@/utils/pricing';
import { useOperationQueue } from './useOperationQueue';
import { ServiceValidator } from '@/utils/serviceValidation';
import { useServiceOperationTracking } from './useServiceOperationTracking';

interface BookingService {
  id: string;
  service_id: string;
  service_name: string;
  base_price: number;
  quantity: number;
  configuration: any;
  booking_id?: string;
  created_at?: string;
  updated_at?: string;
}

interface OptimisticService extends BookingService {
  isOptimistic?: boolean;
}

export const useRealTimeInvoiceOperations = (bookingId: string | null) => {
  const [services, setServices] = useState<OptimisticService[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalPrice, setTotalPrice] = useState(0);
  const [workerId, setWorkerId] = useState<string | undefined>();
  const { toast } = useToast();
  const { enqueue, isProcessing: queueProcessing } = useOperationQueue();
  const { trackAddSuccess, trackAddFailure, trackUpdateOperation, trackRemoveOperation } = useServiceOperationTracking();

  // Get current user ID
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setWorkerId(data.user?.id);
    });
  }, []);

  // Fetch services
  const fetchServices = async () => {
    if (!bookingId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('booking_services')
        .select('*')
        .eq('booking_id', bookingId)
        .order('created_at');

      if (error) throw error;
      
      setServices(data || []);
    } catch (error) {
      console.error('Error fetching services:', error);
      toast({
        title: "Error",
        description: "Failed to load booking services",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Real-time subscription
  useEffect(() => {
    if (!bookingId) return;

    // Debounce mechanism to prevent rapid updates
    let debounceTimer: NodeJS.Timeout;
    
    const debouncedFetch = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        fetchServices();
      }, 300); // Wait 300ms after last update before fetching
    };

    const channel = supabase
      .channel('booking-services-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'booking_services',
          filter: `booking_id=eq.${bookingId}`
        },
        (payload) => {
          console.log('Realtime update:', payload);
          debouncedFetch();
        }
      )
      .subscribe();

    return () => {
      clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
    };
  }, [bookingId]);

  // Calculate total price
  useEffect(() => {
    const total = calculateBookingTotal(services);
    setTotalPrice(total);
  }, [services]);

  // Initial fetch
  useEffect(() => {
    fetchServices();
  }, [bookingId]);

  const calculateServicePrice = (service: BookingService) => {
    return calculateServiceLinePrice(service);
  };

  const addService = async (serviceData: any) => {
    if (!bookingId) {
      toast({
        title: "Error",
        description: "No booking ID provided. Cannot add service.",
        variant: "destructive",
      });
      return;
    }

    // PHASE 3: Comprehensive pre-insertion validation
    const validationResult = await ServiceValidator.validateServiceAddition(
      bookingId,
      serviceData,
      false // Don't skip duplicate check
    );

    if (!validationResult.valid) {
      const errorMessage = ServiceValidator.formatErrors(validationResult.errors || []);
      toast({
        title: "Validation Failed",
        description: errorMessage,
        variant: "destructive",
      });
      return;
    }

    // Generate optimistic ID
    const optimisticId = `optimistic-${Date.now()}-${Math.random()}`;
    
    // Add service optimistically to UI
    const optimisticService: OptimisticService = {
      id: optimisticId,
      booking_id: bookingId,
      service_id: serviceData.id,
      service_name: serviceData.name,
      base_price: serviceData.base_price,
      quantity: serviceData.quantity || 1,
      configuration: serviceData.configuration || {},
      isOptimistic: true,
    };

    setServices(prev => [...prev, optimisticService]);

    // Queue the actual database operation
    return enqueue(async () => {
      const startTime = performance.now();
      try {
        // Check if service already exists with same configuration (idempotency)
        const configString = JSON.stringify(serviceData.configuration || {});
        const { data: existingService } = await supabase
          .from('booking_services')
          .select('*')
          .eq('booking_id', bookingId)
          .eq('service_id', serviceData.id)
          .eq('configuration', configString)
          .maybeSingle();

        if (existingService) {
          // Service already exists - update quantity instead
          const newQuantity = existingService.quantity + (serviceData.quantity || 1);
          const { data, error } = await supabase
            .from('booking_services')
            .update({ quantity: newQuantity })
            .eq('id', existingService.id)
            .select()
            .single();

          if (error) {
            // Remove optimistic service on error
            setServices(prev => prev.filter(s => s.id !== optimisticId));
            throw new Error(`Failed to update service quantity: ${error.message}`);
          }

          // Replace optimistic with real service
          setServices(prev => 
            prev.map(s => s.id === optimisticId ? { ...data, isOptimistic: false } : s)
          );

          const duration = performance.now() - startTime;
          
          // Track successful operation
          await trackAddSuccess(
            bookingId,
            { id: serviceData.id, name: serviceData.name, quantity: newQuantity },
            duration,
            user?.id
          );

          toast({
            title: "Service Updated",
            description: `${serviceData.name} quantity increased to ${newQuantity}`,
          });

          return data;
        }

        // Insert new service
        const bookingService = {
          booking_id: bookingId,
          service_id: serviceData.id,
          service_name: serviceData.name,
          base_price: serviceData.base_price,
          quantity: serviceData.quantity || 1,
          configuration: serviceData.configuration || {}
        };

        const { data, error } = await supabase
          .from('booking_services')
          .insert(bookingService)
          .select()
          .single();

        if (error) {
          // Remove optimistic service on error
          setServices(prev => prev.filter(s => s.id !== optimisticId));
          
          // Provide specific error message
          if (error.code === '23505') { // Unique violation
            throw new Error('This service has already been added to the booking.');
          } else if (error.code === '23503') { // Foreign key violation
            throw new Error('Invalid service or booking ID. Please refresh and try again.');
          } else {
            throw new Error(`Database error: ${error.message}`);
          }
        }

        // Replace optimistic with real service
        setServices(prev => 
          prev.map(s => s.id === optimisticId ? { ...data, isOptimistic: false } : s)
        );

        const duration = performance.now() - startTime;
        
        // Track successful operation
        await trackAddSuccess(
          bookingId,
          { id: serviceData.id, name: serviceData.name, quantity: serviceData.quantity || 1 },
          duration,
          user?.id
        );

        toast({
          title: "Service Added Successfully",
          description: `${serviceData.name} has been added to the booking`,
        });

        return data;
      } catch (error: any) {
        console.error('Error adding service:', error);
        
        const duration = performance.now() - startTime;
        
        // Track failed operation
        await trackAddFailure(
          bookingId,
          { id: serviceData.id, name: serviceData.name, quantity: serviceData.quantity || 1 },
          { code: error.code, message: error.message, details: error },
          duration,
          user?.id
        );
        
        // Remove optimistic service
        setServices(prev => prev.filter(s => s.id !== optimisticId));
        
        toast({
          title: "Failed to Add Service",
          description: error.message || "An unexpected error occurred. Please try again.",
          variant: "destructive",
        });
        throw error;
      }
    }, `Add ${serviceData.name}`);
  };

  const updateService = async (serviceId: string, updates: Partial<BookingService>) => {
    // Update optimistically
    const serviceToUpdate = services.find(s => s.id === serviceId);
    setServices(prev => 
      prev.map(s => s.id === serviceId ? { ...s, ...updates } : s)
    );

    return enqueue(async () => {
      const startTime = performance.now();
      try {
        const { error } = await supabase
          .from('booking_services')
          .update(updates)
          .eq('id', serviceId);

        if (error) {
          // Revert optimistic update
          await fetchServices();
          
          if (error.code === '23505') {
            throw new Error('This update would create a duplicate service.');
          } else if (error.code === '42501') {
            throw new Error('You do not have permission to update this service.');
          } else {
            throw new Error(`Update failed: ${error.message}`);
          }
        }

        const duration = performance.now() - startTime;
        
        // Track successful update
        if (serviceToUpdate) {
          await trackUpdateOperation(
            bookingId!,
            serviceId,
            serviceToUpdate.service_name,
            true,
            duration,
            user?.id
          );
        }

        toast({
          title: "Service Updated",
          description: "Service details have been updated successfully",
        });

        return true;
      } catch (error: any) {
        console.error('Error updating service:', error);
        
        const duration = performance.now() - startTime;
        
        // Track failed update
        if (serviceToUpdate) {
          await trackUpdateOperation(
            bookingId!,
            serviceId,
            serviceToUpdate.service_name,
            false,
            duration,
            user?.id,
            { code: error.code, message: error.message }
          );
        }
        
        toast({
          title: "Update Failed",
          description: error.message || "Failed to update service. Please try again.",
          variant: "destructive",
        });
        throw error;
      }
    }, 'Update service');
  };

  const removeService = async (serviceId: string) => {
    // Store service for potential rollback
    const serviceToRemove = services.find(s => s.id === serviceId);
    
    if (!serviceToRemove) {
      toast({
        title: "Error",
        description: "Service not found",
        variant: "destructive",
      });
      return false;
    }

    // Remove optimistically
    setServices(prev => prev.filter(s => s.id !== serviceId));

    return enqueue(async () => {
      const startTime = performance.now();
      try {
        const { error } = await supabase
          .from('booking_services')
          .delete()
          .eq('id', serviceId);

        if (error) {
          // Rollback optimistic removal
          setServices(prev => [...prev, serviceToRemove]);
          
          if (error.code === '42501') {
            throw new Error('You do not have permission to remove this service.');
          } else if (error.code === '23503') {
            throw new Error('This service cannot be removed because it is referenced by other records.');
          } else {
            throw new Error(`Removal failed: ${error.message}`);
          }
        }

        const duration = performance.now() - startTime;
        
        // Track successful removal
        await trackRemoveOperation(
          bookingId!,
          serviceId,
          serviceToRemove.service_name,
          true,
          duration,
          user?.id
        );

        toast({
          title: "Service Removed",
          description: `${serviceToRemove.service_name} has been removed from the booking`,
        });

        return true;
      } catch (error: any) {
        console.error('Error removing service:', error);
        
        const duration = performance.now() - startTime;
        
        // Track failed removal
        await trackRemoveOperation(
          bookingId!,
          serviceId,
          serviceToRemove.service_name,
          false,
          duration,
          user?.id,
          { code: error.code, message: error.message }
        );
        
        toast({
          title: "Removal Failed",
          description: error.message || "Failed to remove service. Please try again.",
          variant: "destructive",
        });
        throw error;
      }
    }, `Remove ${serviceToRemove.service_name}`);
  };

  const processModificationPayment = async (paymentMethodId?: string) => {
    if (!bookingId) throw new Error("No booking ID provided");

    try {
      const { data, error } = await supabase.functions.invoke(
        'process-invoice-modification-payment',
        {
          body: {
            bookingId,
            paymentMethodId
          }
        }
      );

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || "Payment processing failed");
      }

      toast({
        title: "Payment Processed",
        description: "Invoice modification payment completed successfully",
      });

      return data;
    } catch (error) {
      console.error('Error processing payment:', error);
      toast({
        title: "Payment Error",
        description: error.message || "Failed to process payment",
        variant: "destructive",
      });
      throw error;
    }
  };

  return {
    services,
    loading: loading || queueProcessing,
    totalPrice,
    calculateServicePrice,
    addService,
    updateService,
    removeService,
    processModificationPayment,
    refetch: fetchServices,
    isQueueProcessing: queueProcessing,
  };
};