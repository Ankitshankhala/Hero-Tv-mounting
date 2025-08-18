import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { calculateServiceLinePrice, calculateBookingTotal } from '@/utils/pricing';

interface BookingService {
  id: string;
  service_id: string;
  service_name: string;
  base_price: number;
  quantity: number;
  configuration: any;
}

export const useRealTimeInvoiceOperations = (bookingId: string | null) => {
  const [services, setServices] = useState<BookingService[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalPrice, setTotalPrice] = useState(0);
  const { toast } = useToast();

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
          fetchServices();
        }
      )
      .subscribe();

    return () => {
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
    if (!bookingId) return;

    try {
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

      if (error) throw error;

      toast({
        title: "Service Added",
        description: `${serviceData.name} added to booking`,
      });

      return data;
    } catch (error) {
      console.error('Error adding service:', error);
      toast({
        title: "Error",
        description: "Failed to add service",
        variant: "destructive",
      });
      throw error;
    }
  };

  const updateService = async (serviceId: string, updates: Partial<BookingService>) => {
    try {
      const { error } = await supabase
        .from('booking_services')
        .update(updates)
        .eq('id', serviceId);

      if (error) throw error;

      return true;
    } catch (error) {
      console.error('Error updating service:', error);
      toast({
        title: "Error",
        description: "Failed to update service",
        variant: "destructive",
      });
      throw error;
    }
  };

  const removeService = async (serviceId: string) => {
    try {
      const { error } = await supabase
        .from('booking_services')
        .delete()
        .eq('id', serviceId);

      if (error) throw error;

      toast({
        title: "Service Removed",
        description: "Service removed from booking",
      });

      return true;
    } catch (error) {
      console.error('Error removing service:', error);
      toast({
        title: "Error",
        description: "Failed to remove service",
        variant: "destructive",
      });
      throw error;
    }
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
    loading,
    totalPrice,
    calculateServicePrice,
    addService,
    updateService,
    removeService,
    processModificationPayment,
    refetch: fetchServices
  };
};