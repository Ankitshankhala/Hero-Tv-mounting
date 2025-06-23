
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
      
      // Create the booking with correct fields that exist in the database
      const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .insert({
          customer_id: formData.customerEmail, // Using email as customer identifier for now
          scheduled_date: formData.selectedDate?.toISOString().split('T')[0],
          scheduled_start: formData.selectedTime,
          location_notes: `${formData.address}, ${formData.city}, ${formData.region} ${formData.zipcode}. Special instructions: ${formData.specialInstructions}`,
          status: 'pending',
          service_id: services[0]?.id || '', // Using first service as primary service
        })
        .select()
        .single();

      if (bookingError) {
        throw bookingError;
      }

      // For now, we'll store service details in a simple way since booking_services table doesn't exist
      // We could use the booking_service_modifications table or create a new table later
      console.log('Services to be processed:', services);

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
