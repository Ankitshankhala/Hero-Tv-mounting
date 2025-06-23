
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ServiceItem, FormData } from './types';

export const useBookingOperations = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [bookingId, setBookingId] = useState<string>();
  const [showSuccess, setShowSuccess] = useState(false);
  const [successAnimation, setSuccessAnimation] = useState(false);
  const { toast } = useToast();

  const handleBookingSubmit = async (services: ServiceItem[], formData: FormData) => {
    setLoading(true);
    try {
      console.log('Creating booking with data:', { services, formData });
      
      // Create the booking
      const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .insert({
          customer_name: formData.customerName,
          customer_email: formData.customerEmail,
          customer_phone: formData.customerPhone,
          service_address: formData.address,
          zip_code: formData.zipcode,
          city: formData.city,
          region: formData.region,
          scheduled_date: formData.selectedDate?.toISOString().split('T')[0],
          scheduled_start: formData.selectedTime,
          special_instructions: formData.specialInstructions,
          status: 'pending_payment',
          total_amount: services.reduce((total, service) => total + (service.price * service.quantity), 0)
        })
        .select()
        .single();

      if (bookingError) {
        throw bookingError;
      }

      // Add services to the booking
      for (const service of services) {
        const { error: serviceError } = await supabase
          .from('booking_services')
          .insert({
            booking_id: booking.id,
            service_id: service.id,
            quantity: service.quantity,
            unit_price: service.price,
            total_price: service.price * service.quantity,
            service_options: service.options || {}
          });

        if (serviceError) {
          throw serviceError;
        }
      }

      setBookingId(booking.id);
      toast({
        title: "Booking Created! 🎉",
        description: "Your booking has been created successfully. Proceed to payment.",
      });

      return booking.id;
    } catch (error) {
      console.error('Error creating booking:', error);
      toast({
        title: "Booking Failed",
        description: "There was an error creating your booking. Please try again.",
        variant: "destructive",
      });
      return null;
    } finally {
      setLoading(false);
    }
  };

  return {
    currentStep,
    setCurrentStep,
    loading,
    setLoading,
    bookingId,
    setBookingId,
    showSuccess,
    setShowSuccess,
    successAnimation,
    setSuccessAnimation,
    handleBookingSubmit
  };
};
