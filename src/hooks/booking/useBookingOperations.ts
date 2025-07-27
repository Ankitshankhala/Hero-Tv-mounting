
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

      // Support both authenticated and guest bookings
      let customerId = user?.id;

      console.log('🔍 Customer identification process:', {
        hasAuthenticatedUser: !!user,
        userEmail: user?.email,
        formEmail: formData.customerEmail,
        formName: formData.customerName
      });

      // If no authenticated user, create a guest customer record
      if (!user && formData.customerEmail && formData.customerName) {
        console.log('🆕 Creating/finding guest customer for booking');
        
        try {
          // Check if guest customer already exists
          const { data: existingCustomer, error: findError } = await supabase
            .from('users')
            .select('id, email, name')
            .eq('email', formData.customerEmail)
            .eq('role', 'customer')
            .maybeSingle();

          if (findError) {
            console.error('❌ Error searching for existing customer:', findError);
            throw new Error(`Failed to search for existing customer: ${findError.message}`);
          }

          if (existingCustomer) {
            console.log('✅ Found existing guest customer:', existingCustomer.id);
            customerId = existingCustomer.id;
          } else {
            console.log('🆕 Creating new guest customer');
            
            // Validate guest customer data before creation
            const customerData = {
              email: formData.customerEmail,
              name: formData.customerName,
              phone: formData.customerPhone || null,
              city: formData.city,
              zip_code: formData.zipcode,
              role: 'customer' as const
            };

            console.log('👤 Guest customer data:', customerData);

            // Create new guest customer
            const { data: newCustomer, error: customerError } = await supabase
              .from('users')
              .insert(customerData)
              .select('id')
              .single();

            if (customerError) {
              console.error('❌ Failed to create guest customer:', {
                error: customerError,
                errorCode: customerError.code,
                errorDetails: customerError.details,
                customerData
              });
              
              // Provide more specific error messages
              if (customerError.code === '23505') {
                throw new Error('A customer with this email already exists but could not be found');
              } else if (customerError.code === '23502') {
                throw new Error('Missing required customer information');
              } else {
                throw new Error(`Failed to create customer profile: ${customerError.message}`);
              }
            }

            if (!newCustomer) {
              throw new Error('Failed to create customer profile - no customer data returned');
            }

            console.log('✅ Created new guest customer:', newCustomer.id);
            customerId = newCustomer.id;
          }
        } catch (customerCreationError) {
          console.error('❌ Guest customer creation/lookup failed:', customerCreationError);
          throw new Error(`Customer setup failed: ${customerCreationError instanceof Error ? customerCreationError.message : 'Unknown error'}`);
        }
      }

      if (!customerId) {
        console.error('❌ No customer ID available after processing');
        throw new Error('Customer identification failed - please try logging in or check your information');
      }

      console.log('✅ Customer ID established:', customerId);

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
        title: "Booking Created",
        description: "Please complete payment to confirm your booking.",
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
