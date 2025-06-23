
import { useState } from 'react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { ServiceItem, FormData } from './types';

export const useBookingOperations = () => {
  const [loading, setLoading] = useState(false);
  const [bookingId, setBookingId] = useState<string>('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [paymentCompleted, setPaymentCompleted] = useState(false);
  const [successAnimation, setSuccessAnimation] = useState(false);

  const { user } = useAuth();
  const { toast } = useToast();

  const handleBookingSubmit = async (services: ServiceItem[], formData: FormData) => {
    try {
      setLoading(true);

      const primaryServiceId = services.length > 0 ? services[0].id : null;
      
      if (!primaryServiceId) {
        throw new Error('No services selected');
      }

      // Support both authenticated and guest bookings
      let customerId = user?.id;

      // If no authenticated user, create a guest customer record
      if (!user && formData.customerEmail && formData.customerName) {
        console.log('Creating guest customer for booking');
        
        // Check if guest customer already exists
        const { data: existingCustomer } = await supabase
          .from('users')
          .select('id')
          .eq('email', formData.customerEmail)
          .eq('role', 'customer')
          .maybeSingle();

        if (existingCustomer) {
          customerId = existingCustomer.id;
        } else {
          // Create new guest customer
          const { data: newCustomer, error: customerError } = await supabase
            .from('users')
            .insert({
              email: formData.customerEmail,
              name: formData.customerName,
              phone: formData.customerPhone,
              city: formData.city,
              zip_code: formData.zipcode,
              role: 'customer'
            })
            .select('id')
            .single();

          if (customerError) {
            console.error('Failed to create guest customer:', customerError);
            throw new Error('Failed to create customer profile');
          }

          customerId = newCustomer.id;
        }
      }

      if (!customerId) {
        throw new Error('Customer information is required');
      }

      const bookingData = {
        customer_id: customerId,
        service_id: primaryServiceId,
        scheduled_date: format(formData.selectedDate!, 'yyyy-MM-dd'),
        scheduled_start: formData.selectedTime,
        location_notes: `${formData.address}, ${formData.city}\nContact: ${formData.customerName}\nPhone: ${formData.customerPhone}\nEmail: ${formData.customerEmail}\nZIP: ${formData.zipcode}\nSpecial Instructions: ${formData.specialInstructions}`,
        status: 'pending' as const,
        payment_status: 'pending' as const,
        requires_manual_payment: true
      };

      const { data, error } = await supabase
        .from('bookings')
        .insert(bookingData)
        .select()
        .single();

      if (error) throw error;

      setBookingId(data.id);
      
      toast({
        title: "Booking Created",
        description: user ? "Your booking has been created. Please authorize payment." : "Your guest booking has been created. Please authorize payment.",
      });

      return data.id;
    } catch (error) {
      console.error('Error creating booking:', error);
      toast({
        title: "Error",
        description: "Failed to create booking. Please try again.",
        variant: "destructive",
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    setLoading,
    bookingId,
    setBookingId,
    showSuccess,
    setShowSuccess,
    paymentCompleted,
    setPaymentCompleted,
    successAnimation,
    setSuccessAnimation,
    handleBookingSubmit,
    user
  };
};
