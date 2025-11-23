
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
  coupon_code?: string;
  coupon_discount?: number;
  coupon_id?: string;
  subtotal_before_discount?: number;
  services: ServiceItem[]; // CRITICAL: Services array required for proper tip calculation
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

export interface CouponData {
  code: string;
  discountAmount: number;
  couponId: string;
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

  const createInitialBooking = async (
    services: ServiceItem[], 
    formData: FormData,
    couponData?: CouponData | null,
    subtotalBeforeDiscount?: number
  ) => {
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

      // CRITICAL: BLOCKING coverage check - prevent bookings without workers
      console.debug('🔍 Checking ZIP coverage (BLOCKING - will fail if no coverage)...');
      const { data: coverageData, error: coverageError } = await supabase.rpc(
        'zip_has_active_coverage',
        { p_zipcode: formData.zipcode }
      );

      if (coverageError) {
        console.error('Coverage check RPC error:', coverageError);
        throw new Error('Unable to verify service coverage. Please try again or contact support.');
      }

      if (!coverageData) {
        console.warn('No coverage found for ZIP:', formData.zipcode);
        throw new Error(`Sorry, we don't currently service ZIP code ${formData.zipcode}. Please contact us to request coverage in your area.`);
      }

      console.debug('✅ Coverage confirmed for ZIP:', formData.zipcode);

      // PHASE 1: CRITICAL BLOCKING CHECK - Verify actual worker availability
      console.debug('🔍 Checking worker availability for selected time slot (BLOCKING)...');
      const { data: availableWorkers, error: availError } = await supabase.rpc(
        'find_available_workers_by_zip',
        {
          p_zipcode: formData.zipcode,
          p_date: format(formData.selectedDate!, 'yyyy-MM-dd'),
          p_time: formData.selectedTime,
          p_duration_minutes: 60
        }
      );

      if (availError) {
        console.error('❌ Worker availability check failed:', availError);
        throw new Error('Unable to verify worker availability. Please try again or contact support.');
      }

      if (!availableWorkers || availableWorkers.length === 0) {
        console.warn('⚠️ No workers available:', {
          zipcode: formData.zipcode,
          date: format(formData.selectedDate!, 'yyyy-MM-dd'),
          time: formData.selectedTime
        });
        throw new Error(
          `Sorry, no workers are available in ZIP ${formData.zipcode} ` +
          `on ${format(formData.selectedDate!, 'EEEE, MMM d, yyyy')} at ${formData.selectedTime}. ` +
          `Please select a different date or time slot.`
        );
      }

      console.debug('✅ Workers available:', availableWorkers.length, 'workers');

      // If preferred worker specified, verify they're in the available list
      if ((formData as any).preferredWorkerId) {
        const preferredAvailable = availableWorkers.some(
          (w: any) => w.worker_id === (formData as any).preferredWorkerId
        );
        
        if (!preferredAvailable) {
          console.warn('⚠️ Preferred worker not available, will auto-assign');
          toast({
            title: "Preferred Worker Unavailable",
            description: "Your preferred worker is not available at this time. We'll assign another qualified worker.",
            variant: "default"
          });
          // Clear preferred worker ID
          delete (formData as any).preferredWorkerId;
        }
      }

      // Derive city if missing from ZIP validation
      let effectiveCity = formData.city;
      if (!effectiveCity || effectiveCity.trim().length < 2) {
        console.debug('City missing, attempting to derive from ZIP...');
        try {
          const zipData = await validateUSZipcode(formData.zipcode);
          if (zipData?.city) {
            effectiveCity = zipData.city;
            console.debug('Derived city from ZIP:', effectiveCity);
          }
        } catch (zipError) {
          console.warn('Could not derive city from ZIP:', zipError);
        }
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

      // PHASE 2: Reserve the best available worker (15-minute hold)
      console.debug('🎯 Reserving worker for 15 minutes...');
      const reservedWorker = availableWorkers[0]; // Best match (first in list from RPC)
      const reservationExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes from now

      // Create booking with payment_pending status + worker reservation
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
        reserved_worker_id: reservedWorker.worker_id,
        reservation_expires_at: reservationExpiry.toISOString(),
        // Coupon data - passed as explicit parameters
        coupon_code: couponData?.code || null,
        coupon_discount: couponData?.discountAmount || null,
        coupon_id: couponData?.couponId || null,
        subtotal_before_discount: couponData ? subtotalBeforeDiscount : null,
        guest_customer_info: !user ? {
          email: formData.customerEmail,
          name: formData.customerName,
          phone: formData.customerPhone,
          address: formData.address,
          unit: formData.houseNumber,
          apartment_name: formData.apartmentName,
          city: effectiveCity,
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
        
        // Insert booking services for authenticated users
        if (services && services.length > 0) {
          const bookingServices = services.map(service => ({
            booking_id: newBooking.id,
            service_id: service.id,
            service_name: service.name,
            base_price: service.price,
            quantity: service.quantity,
            configuration: service.options || null
          }));

          const { error: servicesError } = await supabase
            .from('booking_services')
            .insert(bookingServices);

          if (servicesError) {
            console.error('Failed to insert booking services:', servicesError);
            throw new Error(`Failed to create booking services: ${servicesError.message}`);
          }

          console.log('✅ Inserted booking services for authenticated user:', bookingServices.length);
        }
      }

      if (!newBooking) {
        throw new Error('Failed to create booking - no booking data returned');
      }

      setBookingId(newBooking.id);
      
      // Store booking state in session storage for persistence
      sessionStorage.setItem('pendingBookingId', newBooking.id);
      sessionStorage.setItem('pendingBookingTimestamp', Date.now().toString());
      
      console.debug('✅ Worker reserved:', {
        worker_id: reservedWorker.worker_id,
        worker_name: reservedWorker.worker_name,
        expires_at: reservationExpiry.toISOString()
      });
      
      toast({
        title: "Worker Reserved!",
        description: `Your booking is created and a worker is reserved for 15 minutes. Please complete payment to confirm.`,
      });

      return newBooking.id;
    } catch (error) {
      console.error('❌ Booking creation failed:', error);
      
      // PHASE 1: Enhanced error messages based on error type
      let userMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      
      if (userMessage.includes('no workers are available')) {
        // Already has good message, keep it
      } else if (userMessage.includes('coverage') || userMessage.includes('don\'t currently service')) {
        userMessage = `We don't currently service your area (ZIP: ${formData.zipcode}). ` +
          `Please contact us at bookings@herotvmounting.com to request coverage.`;
      } else if (userMessage.includes('authentication') || userMessage.includes('RLS') || userMessage.includes('row-level security')) {
        userMessage = 'Authentication error. Please refresh the page and try again.';
      } else if (!userMessage.includes('minimum') && !userMessage.includes('required')) {
        userMessage = 'Unable to create booking. Please try again or contact support.';
      }
      
      toast({
        title: 'Booking Failed',
        description: userMessage,
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

      // PHASE 2: Check if we have a reserved worker and if reservation is still valid
      const { data: bookingDetails, error: fetchError } = await supabase
        .from('bookings')
        .select('reserved_worker_id, reservation_expires_at, status')
        .eq('id', bookingId)
        .single();

      if (fetchError) {
        console.error('Failed to fetch booking details:', fetchError);
      }

      let finalWorkerId = null;
      let workerReservationStatus = 'none';

      if (bookingDetails?.reserved_worker_id && 
          bookingDetails.reservation_expires_at &&
          new Date(bookingDetails.reservation_expires_at) > new Date()) {
        // Reservation still valid, use it
        console.log('✅ Using reserved worker:', bookingDetails.reserved_worker_id);
        finalWorkerId = bookingDetails.reserved_worker_id;
        workerReservationStatus = 'reserved_used';
      } else if (bookingDetails?.reserved_worker_id) {
        console.warn('⚠️ Reservation expired, will attempt fresh assignment');
        workerReservationStatus = 'expired';
      }

      // Step 1: Update booking to payment_authorized + finalize worker assignment
      const { data: updatedBooking, error: updateError } = await supabase
        .from('bookings')
        .update({
          status: 'payment_authorized' as const,
          payment_status: 'authorized',
          payment_intent_id: paymentIntentId,
          worker_id: finalWorkerId, // Finalize assignment if reservation was valid
          reserved_worker_id: null, // Clear reservation
          reservation_expires_at: null
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

      console.debug('[confirmBookingAfterPayment] Booking status updated to payment_authorized');

      // Step 2: Explicitly trigger worker assignment (backup to database trigger)
      try {
        console.debug('[confirmBookingAfterPayment] Triggering worker assignment explicitly');
        const { data: assignmentData, error: assignmentError } = await supabase.functions.invoke(
          'assign-authorized-booking-worker',
          { body: { booking_id: bookingId } }
        );

        if (assignmentError) {
          console.warn('[confirmBookingAfterPayment] Worker assignment invocation error:', assignmentError);
          // Don't throw - the database trigger should handle this
        } else {
          console.debug('[confirmBookingAfterPayment] Worker assignment triggered:', assignmentData);
        }
      } catch (assignError) {
        console.warn('[confirmBookingAfterPayment] Worker assignment failed, relying on DB trigger:', assignError);
        // Continue - the database trigger will handle assignment
      }

      // Step 3: Show user feedback
      const guestInfo = updatedBooking.guest_customer_info as any;
      const hasZipcode = updatedBooking.customer?.zip_code || guestInfo?.zipcode;
      
      if (hasZipcode) {
        try {
          // Explicitly call auto-assignment after booking confirmation
          const { data: assignmentResult, error: assignmentError } = await supabase.rpc(
            'auto_assign_workers_with_strict_zip_coverage', 
            { p_booking_id: bookingId }
          );
          
          if (assignmentError) {
            console.error('Auto-assignment failed:', assignmentError);
            // PHASE 3: Enhanced error handling for assignment failures
            toast({
              title: "Assignment Pending",
              description: "Your payment is secured. We're finding the best available worker and will notify you within 1 hour.",
              variant: "default",
            });
            
            // Flag for admin attention
            await supabase
              .from('bookings')
              .update({ 
                status: 'pending',
                requires_manual_payment: true
              })
              .eq('id', bookingId);
              
            // Create urgent admin alert
            await supabase
              .from('sms_logs')
              .insert({
                booking_id: bookingId,
                recipient_number: 'admin',
                message: `URGENT: Booking ${bookingId} authorized payment but auto-assignment failed`,
                status: 'pending'
              });
          } else if (assignmentResult && assignmentResult[0]?.assignment_status === 'no_zip_coverage') {
            // PHASE 4: CRITICAL - Payment authorized but no worker available
            console.error('❌ CRITICAL: Payment authorized but no ZIP coverage!');
            
            // Create admin alert in new table
            const alertMessage = `CRITICAL: Booking ${bookingId} - Payment authorized but no worker coverage in ZIP. Customer paid but service cannot be fulfilled!`;
            await supabase
              .from('admin_alerts')
              .insert({
                alert_type: 'CRITICAL_NO_WORKER_ASSIGNED',
                booking_id: bookingId,
                severity: 'critical',
                message: alertMessage,
                details: {
                  payment_intent_id: paymentIntentId,
                  zipcode: hasZipcode,
                  worker_reservation_status: workerReservationStatus
                }
              });
            
            // Also log to SMS for immediate notification
            await supabase
              .from('sms_logs')
              .insert({
                booking_id: bookingId,
                recipient_number: 'admin',
                message: alertMessage,
                status: 'pending'
              });
            
            toast({
              title: "Assignment Issue",
              description: "Your payment is secured. Our team will contact you within 1 hour to schedule your service.",
              variant: "destructive",
            });
          } else {
            toast({
              title: "Booking Confirmed & Worker Assigned",
              description: "Your booking is confirmed and a worker has been assigned. You'll receive confirmation details shortly.",
            });
          }
        } catch (error) {
          console.error('Assignment error:', error);
          toast({
            title: "Booking Confirmed",
            description: "Your booking is confirmed. We're working to assign a worker and will notify you soon.",
          });
        }
      } else {
        toast({
          title: "Booking Confirmed",
          description: "Your booking is confirmed. Please contact support to complete the service assignment.",
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

      // CRITICAL: Validate services array before creating booking
      if (!bookingData.services || bookingData.services.length === 0) {
        optimizedError('CRITICAL: Attempting to create booking without services array');
        return {
          booking_id: '',
          assigned_workers: [],
          status: 'error',
          message: 'Invalid booking data: services are required'
        };
      }

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
            requires_manual_payment: true,
            services: bookingData.services // CRITICAL FIX: Pass services array
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
