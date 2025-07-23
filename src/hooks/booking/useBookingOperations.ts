
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

  const handleBookingSubmit = async (services: ServiceItem[], formData: FormData, paymentData?: { payment_intent_id?: string; payment_status?: string; amount?: number }) => {
    try {
      setLoading(true);

      console.log('🚀 Starting booking submission process:', {
        servicesCount: services?.length,
        formDataKeys: formData ? Object.keys(formData) : [],
        customerEmail: formData?.customerEmail,
        customerName: formData?.customerName,
        selectedDate: formData?.selectedDate,
        selectedTime: formData?.selectedTime,
        zipcode: formData?.zipcode,
        paymentData: {
          payment_intent_id: paymentData?.payment_intent_id,
          payment_status: paymentData?.payment_status,
          amount: paymentData?.amount,
          amountType: typeof paymentData?.amount
        }
      });

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

      // Use enhanced booking logic with auto-assignment
      const enhancedBookingData: EnhancedBookingData = {
        customer_id: customerId,
        service_id: primaryServiceId,
        scheduled_date: format(formData.selectedDate!, 'yyyy-MM-dd'),
        scheduled_start: formData.selectedTime,
        location_notes: `${formData.houseNumber} ${formData.address}, ${formData.city}\nContact: ${formData.customerName}\nPhone: ${formData.customerPhone}\nEmail: ${formData.customerEmail}\nZIP: ${formData.zipcode}\nSpecial Instructions: ${formData.specialInstructions}`,
        customer_zipcode: formData.zipcode,
        payment_intent_id: paymentData?.payment_intent_id,
        payment_status: paymentData?.payment_status || 'pending',
        payment_amount: paymentData?.amount // Pass the actual payment amount
      };

      console.log('📋 Enhanced booking data prepared:', {
        customer_id: customerId,
        service_id: primaryServiceId,
        scheduled_date: enhancedBookingData.scheduled_date,
        scheduled_start: enhancedBookingData.scheduled_start,
        customer_zipcode: enhancedBookingData.customer_zipcode,
        location_notes_length: enhancedBookingData.location_notes?.length
      });

      console.log('🔄 Calling createEnhancedBooking with comprehensive logging...');
      const enhancedBookingOperationId = `enhanced-booking-${Date.now()}`;
      console.log(`📋 [${enhancedBookingOperationId}] About to call createEnhancedBooking`, {
        enhancedBookingData,
        timestamp: new Date().toISOString()
      });

      const result = await createEnhancedBooking(enhancedBookingData);
      
      console.log(`📊 [${enhancedBookingOperationId}] Enhanced booking result received:`, {
        operationId: enhancedBookingOperationId,
        status: result.status,
        booking_id: result.booking_id,
        worker_assigned: result.worker_assigned,
        notifications_sent: result.notifications_sent,
        message: result.message,
        timestamp: new Date().toISOString(),
        success: result.status !== 'error'
      });

      // Additional validation of the result
      if (result.status === 'error' && !result.message) {
        console.error(`❌ [${enhancedBookingOperationId}] Error result missing message:`, result);
        throw new Error('Enhanced booking returned error status but no error message');
      }
      
      if (result.status !== 'error' && !result.booking_id) {
        console.error(`❌ [${enhancedBookingOperationId}] Success result missing booking_id:`, result);
        throw new Error('Enhanced booking succeeded but returned no booking ID');
      }
      
      if (result.status === 'error') {
        console.error('❌ Enhanced booking returned error status:', result);
        throw new Error(result.message || 'Enhanced booking creation failed');
      }

      if (!result.booking_id) {
        console.error('❌ No booking ID returned from enhanced booking');
        throw new Error('Booking was processed but no booking ID was returned');
      }

      setBookingId(result.booking_id);
      
      // Show appropriate message based on assignment status
      let toastMessage = result.message;
      if (result.worker_assigned) {
        toastMessage = "Booking confirmed! Worker has been automatically assigned.";
      } else if (result.notifications_sent && result.notifications_sent > 0) {
        toastMessage = `Booking created! Coverage requests sent to ${result.notifications_sent} workers in your area.`;
      }
      
      toast({
        title: result.status === 'confirmed' ? "Booking Confirmed" : "Booking Created",
        description: toastMessage,
      });

      return result.booking_id;
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
    validateMinimumCart,
    user,
    MINIMUM_BOOKING_AMOUNT
  };
};
