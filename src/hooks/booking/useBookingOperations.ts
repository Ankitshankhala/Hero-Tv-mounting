
import { useState } from 'react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { ServiceItem, FormData } from './types';
import { createEnhancedBooking, EnhancedBookingData } from '@/utils/enhancedBookingLogic';

const MINIMUM_BOOKING_AMOUNT = 75;

export const useBookingOperations = () => {
  const [loading, setLoading] = useState(false);
  const [bookingId, setBookingId] = useState<string>('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [paymentCompleted, setPaymentCompleted] = useState(false);
  const [successAnimation, setSuccessAnimation] = useState(false);

  const { user } = useAuth();
  const { toast } = useToast();

  const validateMinimumCart = (services: ServiceItem[]): boolean => {
    const total = services.reduce((sum, service) => sum + (service.price * service.quantity), 0);
    
    if (total < MINIMUM_BOOKING_AMOUNT) {
      const amountNeeded = MINIMUM_BOOKING_AMOUNT - total;
      toast({
        title: "Minimum Booking Amount Required",
        description: `Your cart total is $${total}. Please add $${amountNeeded} more to reach the minimum booking amount of $${MINIMUM_BOOKING_AMOUNT}.`,
        variant: "destructive",
      });
      return false;
    }
    
    return true;
  };

  const createInitialBooking = async (services: ServiceItem[], formData: FormData) => {
    try {
      setLoading(true);

      console.log('🚀 Creating initial booking with payment_pending status');

      // Enhanced validation with detailed error messages
      if (!services || services.length === 0) {
        throw new Error('At least one service must be selected for booking');
      }

      if (!formData) {
        throw new Error('Booking form data is required');
      }

      // Validate required customer information
      if (!formData.customerEmail || !formData.customerEmail.includes('@')) {
        throw new Error('Valid customer email is required');
      }

      if (!formData.customerName || formData.customerName.trim().length < 2) {
        throw new Error('Customer name is required (minimum 2 characters)');
      }

      // Validate location information
      if (!formData.zipcode || formData.zipcode.length < 5) {
        throw new Error('Valid zipcode is required for service location');
      }

      if (!formData.city || formData.city.trim().length < 2) {
        throw new Error('City information is required');
      }

      if (!formData.address || formData.address.trim().length < 5) {
        throw new Error('Street address is required');
      }

      // Validate scheduling information
      if (!formData.selectedDate) {
        throw new Error('Service date must be selected');
      }

      if (!formData.selectedTime) {
        throw new Error('Service time must be selected');
      }

      // Validate minimum cart amount first
      if (!validateMinimumCart(services)) {
        throw new Error(`Minimum booking amount of $${MINIMUM_BOOKING_AMOUNT} not met`);
      }

      const primaryServiceId = services.length > 0 ? services[0].id : null;
      
      if (!primaryServiceId) {
        throw new Error('Primary service ID not found');
      }

      console.log('✅ All validations passed, proceeding with booking creation');

      // Support both authenticated users and guests
      const customerId = user?.id || null; // NULL for guests, user ID for authenticated users

      console.log('🔍 Customer identification process:', {
        hasAuthenticatedUser: !!user,
        userEmail: user?.email,
        formEmail: formData.customerEmail,
        formName: formData.customerName,
        isGuest: !user
      });

      console.log('✅ Customer ID established:', customerId || 'guest');

      // Create booking with payment_pending status
      const bookingData = {
        customer_id: customerId,
        service_id: primaryServiceId,
        scheduled_date: format(formData.selectedDate!, 'yyyy-MM-dd'),
        scheduled_start: formData.selectedTime,
        location_notes: `${formData.houseNumber} ${formData.address}, ${formData.city}\nContact: ${formData.customerName}\nPhone: ${formData.customerPhone}\nEmail: ${formData.customerEmail}\nZIP: ${formData.zipcode}\nSpecial Instructions: ${formData.specialInstructions}`,
        status: 'payment_pending' as const,
        payment_status: 'pending',
        requires_manual_payment: false,
        guest_customer_info: !user ? {
          email: formData.customerEmail,
          name: formData.customerName,
          phone: formData.customerPhone,
          address: formData.address,
          city: formData.city,
          zipcode: formData.zipcode,
        } : null
      };

      console.log('📋 Creating booking with payment_pending status');

      const { data: newBooking, error: bookingError } = await supabase
        .from('bookings')
        .insert(bookingData)
        .select('id')
        .single();

      if (bookingError) {
        console.error('❌ Booking creation failed:', bookingError);
        throw new Error(`Failed to create booking: ${bookingError.message}`);
      }

      if (!newBooking) {
        throw new Error('Failed to create booking - no booking data returned');
      }

      console.log('✅ Initial booking created with ID:', newBooking.id);
      setBookingId(newBooking.id);
      
      toast({
        title: "Your booking is created!",
        description: "To confirm it, please complete the payment now.",
      });

      return newBooking.id;
    } catch (error) {
      console.error('Error creating initial booking:', error);
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

  const confirmBookingAfterPayment = async (bookingId: string, paymentIntentId: string) => {
    try {
      console.log('🎯 Confirming booking after successful payment:', { bookingId, paymentIntentId });

      const { data: updatedBooking, error: updateError } = await supabase
        .from('bookings')
        .update({
          status: 'confirmed' as const,
          payment_status: 'authorized',
          payment_intent_id: paymentIntentId
        })
        .eq('id', bookingId)
        .select(`
          *,
          customer:users!customer_id(*),
          service:services(*)
        `)
        .single();

      if (updateError) {
        console.error('❌ Failed to confirm booking:', updateError);
        throw new Error(`Failed to confirm booking: ${updateError.message}`);
      }

      console.log('✅ Booking confirmed successfully:', updatedBooking.id);

      // Auto-assign worker after confirmation
      if (updatedBooking.customer?.zip_code) {
        console.log('🔄 Attempting worker auto-assignment for confirmed booking');
        
        const { data: assignmentData, error: assignmentError } = await supabase.rpc(
          'auto_assign_workers_with_coverage',
          { p_booking_id: bookingId }
        );

        if (assignmentError) {
          console.error('❌ Worker assignment failed:', assignmentError);
        } else {
          console.log('✅ Worker assignment completed:', assignmentData);
        }
      }

      toast({
        title: "Booking Confirmed!",
        description: "Your payment has been authorized and your booking is now confirmed.",
      });

      return updatedBooking;
    } catch (error) {
      console.error('Error confirming booking:', error);
      toast({
        title: "Error",
        description: "Payment succeeded but failed to confirm booking. Please contact support.",
        variant: "destructive",
      });
      throw error;
    }
  };

  // Legacy method for backward compatibility
  const handleBookingSubmit = async (services: ServiceItem[], formData: FormData, paymentData?: { payment_intent_id?: string; payment_status?: string; amount?: number }) => {
    // This now just calls the createInitialBooking method
    return await createInitialBooking(services, formData);
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
    createInitialBooking,
    confirmBookingAfterPayment,
    validateMinimumCart,
    user,
    MINIMUM_BOOKING_AMOUNT
  };
};
