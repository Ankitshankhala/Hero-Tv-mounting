
import { useState } from 'react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { ServiceItem, FormData } from './types';

import { useTestingMode, getEffectiveMinimumAmount, getEffectiveServicePrice } from '@/contexts/TestingModeContext';
import { validateUSZipcode } from '@/utils/zipcodeValidation';
import { optimizedLog, optimizedError, measurePerformance } from '@/utils/performanceOptimizer';

// Enhanced interfaces for unified booking system
export interface UnauthenticatedBookingData {
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  customer_address?: string;
  customer_unit?: string;
  customer_apartment_name?: string;
  customer_zipcode: string;
  service_id: string;
  scheduled_date: string;
  scheduled_start: string;
  location_notes?: string;
  total_price: number;
  duration_minutes: number;
}

export interface AdminBookingData {
  customer_id?: string | null;
  guest_customer_info?: {
    name: string;
    email: string;
    phone: string;
    zipcode: string;
    city?: string;
    address?: string;
  };
  service_id: string;
  scheduled_date: string;
  scheduled_start: string;
  location_notes?: string;
  status?: 'pending' | 'confirmed' | 'payment_pending' | 'payment_authorized';
  payment_status?: string;
  requires_manual_payment?: boolean;
  worker_id?: string | null;
}

export interface CreateBookingResult {
  booking_id: string;
  assigned_workers: any[];
  status: 'confirmed' | 'pending' | 'error';
  message: string;
}

export const useBookingOperations = () => {
  const { isTestingMode } = useTestingMode();
  const MINIMUM_BOOKING_AMOUNT = getEffectiveMinimumAmount(isTestingMode);
  
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

      // Unit number is now optional
      // if (!formData.houseNumber || formData.houseNumber.trim().length === 0) {
      //   throw new Error('Unit number is required');
      // }

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

      // Support both authenticated users and guests
      const customerId = user?.id || null; // NULL for guests, user ID for authenticated users

      // Check for existing pending booking to prevent duplicates
      let existingBooking = null;
      try {
        const { data, error } = await supabase.rpc('find_existing_pending_booking' as any, {
          p_customer_id: customerId,
          p_guest_email: !user ? formData.customerEmail : null,
          p_guest_phone: !user ? formData.customerPhone : null,
          p_scheduled_date: format(formData.selectedDate!, 'yyyy-MM-dd'),
          p_scheduled_start: formData.selectedTime,
          p_grace_period_minutes: 30
        });

        if (!error && data && Array.isArray(data) && data.length > 0) {
          existingBooking = data[0];
        }
      } catch (error) {
        console.warn('Duplicate check failed, continuing with new booking:', error);
      }

      // If existing booking found, return it instead of creating new one
      if (existingBooking) {
        optimizedLog('✅ Found existing pending booking, resuming...', existingBooking.booking_id);
        setBookingId(existingBooking.booking_id);
        
        // Store booking state in session storage for persistence
        sessionStorage.setItem('pendingBookingId', existingBooking.booking_id);
        sessionStorage.setItem('pendingBookingTimestamp', Date.now().toString());
        
        toast({
          title: "Resuming Previous Booking",
          description: "We found your previous booking attempt. You can complete the payment now.",
        });
        
        return existingBooking.booking_id;
      }

      // Create booking with payment_pending status to ensure proper state for payment
      const bookingData = {
        customer_id: customerId,
        service_id: primaryServiceId,
        scheduled_date: format(formData.selectedDate!, 'yyyy-MM-dd'),
        scheduled_start: formData.selectedTime,
        location_notes: `${formData.address}${formData.houseNumber ? `\nUnit: ${formData.houseNumber}` : ''}${formData.apartmentName ? `\nApartment: ${formData.apartmentName}` : ''}\nContact: ${formData.customerName}\nPhone: ${formData.customerPhone}\nEmail: ${formData.customerEmail}\nZIP: ${formData.zipcode}${formData.tipAmount > 0 ? `\nTip: $${formData.tipAmount.toFixed(2)}` : ''}\nSpecial Instructions: ${formData.specialInstructions}`,
        status: 'payment_pending' as const,
        payment_status: 'pending',
        requires_manual_payment: false,
        preferred_worker_id: (formData as any).preferredWorkerId || null,
        guest_customer_info: !user ? {
          email: formData.customerEmail,
          name: formData.customerName,
          phone: formData.customerPhone,
          address: formData.address,
          unit: formData.houseNumber,
          apartment_name: formData.apartmentName,
          city: formData.city,
          zipcode: formData.zipcode,
          tip_amount: formData.tipAmount || 0,
          preferred_worker_id: (formData as any).preferredWorkerId || null,
        } : null
      };

      console.log('Creating booking with status:', bookingData.status, 'payment_status:', bookingData.payment_status);

      let newBooking;
      
      if (!user) {
        // For guest users, use the edge function to bypass RLS issues
        console.log('📞 Calling create-guest-booking edge function with data:', { bookingData });
        
        const { data: edgeResult, error: edgeError } = await supabase.functions.invoke('create-guest-booking', {
          body: { 
            bookingData: {
              ...bookingData,
              services // Include services for booking_services table
            }
          }
        });

        console.log('📥 Edge function response:', { edgeResult, edgeError });

        if (edgeError) {
          console.error('❌ Edge function error:', edgeError);
          throw new Error(`Failed to create guest booking: ${edgeError.message}`);
        }

        if (!edgeResult?.success) {
          console.error('❌ Edge function returned failure:', edgeResult);
          throw new Error(`Failed to create guest booking: ${edgeResult?.error || 'Unknown error'}`);
        }

        console.log('✅ Guest booking created successfully:', edgeResult.booking_id);
        newBooking = { id: edgeResult.booking_id };
        
      } else {
        // For authenticated users, use direct database access
        const { data: authBooking, error: bookingError } = await supabase
          .from('bookings')
          .insert(bookingData)
          .select('id')
          .single();

        if (bookingError) {
          console.error('Authenticated booking creation error:', bookingError);
          // More specific error messages for common RLS issues
          if (bookingError.message.includes('new row violates row-level security')) {
            throw new Error('Authentication error. Please try refreshing the page and logging in again.');
          }
          throw new Error(`Failed to create booking: ${bookingError.message}`);
        }

        newBooking = authBooking;
      }

      if (!newBooking) {
        throw new Error('Failed to create booking - no booking data returned');
      }

      setBookingId(newBooking.id);
      
      // Store booking state in session storage for persistence
      sessionStorage.setItem('pendingBookingId', newBooking.id);
      sessionStorage.setItem('pendingBookingTimestamp', Date.now().toString());
      
      toast({
        title: "Your booking is created!",
        description: "To confirm it, please complete the payment now.",
      });

      return newBooking.id;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create booking. Please try again.';
      console.error('Booking creation failed:', error);
      toast({
        title: 'Error creating booking',
        description: message,
        variant: 'destructive',
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const confirmBookingAfterPayment = async (bookingId: string, paymentIntentId: string) => {
    try {
      console.log('Confirming booking after payment:', { bookingId, paymentIntentId });

      // First ensure the booking status is compatible, then update to confirmed
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
        throw new Error(`Failed to confirm booking: ${updateError.message}`);
      }

      // Notifications (customer email/SMS) are handled by database triggers after assignment to avoid duplicates.
      // No direct email dispatch here.

      // Auto-assign worker after confirmation - handle both authenticated users and guests
      const guestInfo = updatedBooking.guest_customer_info as any;
      const hasZipcode = updatedBooking.customer?.zip_code || guestInfo?.zipcode;
      let assignmentCompleted = false;
      
      if (hasZipcode) {
        // Let DB triggers handle auto-assignment; just inform the user
        toast({
          title: "Booking Confirmed",
          description: "We’re assigning a worker now. You’ll be notified once confirmed.",
        });
        assignmentCompleted = true;
      } else {
        toast({
          title: "Booking Confirmed",
          description: "Your booking is confirmed. Please contact support to complete the service assignment.",
        });
        assignmentCompleted = true;
      }

      // Only show the generic success message if no specific assignment message was shown
      if (!assignmentCompleted) {
        toast({
          title: "Booking Confirmed!",
          description: "Your payment has been authorized and your booking is now confirmed.",
        });
      }

      return updatedBooking;
    } catch (error) {
      toast({
        title: "Error",
        description: "Payment succeeded but failed to confirm booking. Please contact support.",
        variant: "destructive",
      });
      throw error;
    }
  };

  // Legacy booking creation for unauthenticated users (EmbeddedCheckout)
  const createUnauthenticatedBooking = async (bookingData: UnauthenticatedBookingData): Promise<CreateBookingResult> => {
    setLoading(true);
    try {
      optimizedLog('Creating unauthenticated booking with data:', bookingData);

      // Validate zipcode first
      const zipcodeValidation = await validateUSZipcode(bookingData.customer_zipcode);
      if (!zipcodeValidation) {
        return {
          booking_id: '',
          assigned_workers: [],
          status: 'error',
          message: 'Invalid zipcode. Please enter a valid US zipcode.'
        };
      }

      // Create guest customer info
      const guestCustomerInfo = {
        name: bookingData.customer_name,
        email: bookingData.customer_email,
        phone: bookingData.customer_phone,
        address: bookingData.customer_address,
        unit: bookingData.customer_unit,
        apartment_name: bookingData.customer_apartment_name,
        zipcode: bookingData.customer_zipcode,
        city: zipcodeValidation.city
      };

      // Call create-guest-booking edge function
      const { data: result, error } = await supabase.functions.invoke('create-guest-booking', {
        body: {
          bookingData: {
            customer_id: null,
            guest_customer_info: guestCustomerInfo,
            service_id: bookingData.service_id,
            scheduled_date: bookingData.scheduled_date,
            scheduled_start: bookingData.scheduled_start,
            location_notes: bookingData.location_notes || '',
            status: 'payment_pending',
            payment_status: 'pending',
            requires_manual_payment: true
          }
        }
      });

      if (error) {
        optimizedError('Guest booking creation error:', error);
        return {
          booking_id: '',
          assigned_workers: [],
          status: 'error',
          message: 'Failed to create booking. Please try again.'
        };
      }

      optimizedLog('Guest booking created successfully:', result);

      // Defer worker assignment until after payment authorization; DB triggers will handle it
      return {
        booking_id: result.booking_id,
        assigned_workers: [],
        status: 'pending',
        message: 'Booking created! After payment authorization, we’ll assign a worker and notify you.'
      };
    } catch (error) {
      optimizedError('Error in createUnauthenticatedBooking:', error);
      return {
        booking_id: '',
        assigned_workers: [],
        status: 'error',
        message: 'Failed to create booking. Please try again.'
      };
    } finally {
      setLoading(false);
    }
  };

  // Admin booking creation with enhanced features
  const createAdminBooking = async (bookingData: AdminBookingData): Promise<any> => {
    setLoading(true);
    try {
      optimizedLog('Creating admin booking with data:', bookingData);

      return await measurePerformance('admin-booking-creation', async () => {
        const bookingPayload = {
          customer_id: bookingData.customer_id,
          guest_customer_info: bookingData.guest_customer_info,
          service_id: bookingData.service_id,
          scheduled_date: bookingData.scheduled_date,
          scheduled_start: bookingData.scheduled_start,
          location_notes: bookingData.location_notes || '',
          status: bookingData.status || 'pending',
          payment_status: bookingData.payment_status || 'pending',
          requires_manual_payment: bookingData.requires_manual_payment !== false,
          worker_id: bookingData.worker_id || null
        };

        optimizedLog('Admin booking payload:', bookingPayload);

        const { data, error } = await supabase
          .from('bookings')
          .insert(bookingPayload)
          .select(`
            *,
            customer:users!customer_id(*),
            worker:users!worker_id(*),
            service:services(*)
          `)
          .single();

        if (error) {
          optimizedError('Admin booking creation error:', error);
          throw error;
        }

        optimizedLog('Admin booking created successfully:', data);
        return data;
      });
    } catch (error) {
      optimizedError('Error in createAdminBooking:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Cleanup expired pending bookings
  const cleanupExpiredBookings = async (gracePeriodMinutes: number = 30) => {
    try {
      const { data, error } = await supabase.rpc('cleanup_expired_pending_bookings' as any, {
        p_grace_period_minutes: gracePeriodMinutes
      });

      if (error) {
        console.warn('Cleanup failed:', error);
        return { success: false, error: error.message };
      }

      const cleanedCount = Array.isArray(data) ? data.length : 0;
      console.log(`Cleaned up ${cleanedCount} expired pending bookings`);
      
      return { success: true, cleanedCount, cleanedBookings: data };
    } catch (error) {
      console.warn('Cleanup error:', error);
      return { success: false, error: 'Failed to cleanup expired bookings' };
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
    createInitialBooking,
    confirmBookingAfterPayment,
    validateMinimumCart,
    cleanupExpiredBookings,
    user,
    MINIMUM_BOOKING_AMOUNT,
    // New unified methods
    createUnauthenticatedBooking,
    createAdminBooking
  };
};
