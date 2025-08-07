
import { useState } from 'react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { ServiceItem, FormData } from './types';

import { useTestingMode, getEffectiveMinimumAmount } from '@/contexts/TestingModeContext';
import { validateUSZipcode } from '@/utils/zipcodeValidation';
import { optimizedLog, optimizedError, measurePerformance } from '@/utils/performanceOptimizer';

// Enhanced interfaces for unified booking system
export interface UnauthenticatedBookingData {
  customer_name: string;
  customer_email: string;
  customer_phone: string;
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

      let newBooking;
      
      if (!user) {
        // For guest users, use the edge function to bypass RLS issues
        
        const { data: edgeResult, error: edgeError } = await supabase.functions.invoke('create-guest-booking', {
          body: { 
            bookingData: {
              ...bookingData,
              services // Include services for booking_services table
            }
          }
        });

        if (edgeError) {
          throw new Error(`Failed to create guest booking: ${edgeError.message}`);
        }

        if (!edgeResult?.success) {
          throw new Error(`Failed to create guest booking: ${edgeResult?.error || 'Unknown error'}`);
        }

        newBooking = { id: edgeResult.booking_id };
        
      } else {
        // For authenticated users, use direct database access
        const { data: authBooking, error: bookingError } = await supabase
          .from('bookings')
          .insert(bookingData)
          .select('id')
          .single();

        if (bookingError) {
          throw new Error(`Failed to create booking: ${bookingError.message}`);
        }

        newBooking = authBooking;
      }

      if (!newBooking) {
        throw new Error('Failed to create booking - no booking data returned');
      }

      setBookingId(newBooking.id);
      
      toast({
        title: "Your booking is created!",
        description: "To confirm it, please complete the payment now.",
      });

      return newBooking.id;
    } catch (error) {
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

      // Send customer confirmation email with proper error handling
      try {
        console.log('Triggering customer confirmation email for booking:', bookingId);
        const { data: emailData, error: emailError } = await supabase.functions.invoke('send-customer-booking-confirmation', {
          body: { bookingId }
        });
        
        if (emailError) {
          console.error('Customer email error:', emailError);
          toast({
            title: "Email Warning",
            description: "Booking confirmed but failed to send confirmation email. You can resend it from the admin panel.",
            variant: "destructive",
          });
        } else {
          console.log('Customer confirmation email sent successfully:', emailData);
        }
      } catch (emailError) {
        console.error('Error sending customer confirmation email:', emailError);
        toast({
          title: "Email Warning", 
          description: "Booking confirmed but email service is unavailable. Please check admin panel.",
          variant: "destructive",
        });
      }

      // Auto-assign worker after confirmation - handle both authenticated users and guests
      const guestInfo = updatedBooking.guest_customer_info as any;
      const hasZipcode = updatedBooking.customer?.zip_code || guestInfo?.zipcode;
      let assignmentCompleted = false;
      
      if (hasZipcode) {
        try {
          console.log('Starting auto-assignment for booking:', bookingId, 'with zipcode:', hasZipcode);
          
          const { data: assignmentData, error: assignmentError } = await supabase.rpc(
            'auto_assign_workers_with_coverage',
            { p_booking_id: bookingId }
          );

          if (assignmentError) {
            console.error('Auto-assignment error:', assignmentError);
            toast({
              title: "Booking Confirmed",
              description: "Your booking is confirmed, but we're still finding the best worker for you. You'll be notified soon!",
            });
            assignmentCompleted = true;
          } else {
            console.log('Auto-assignment response:', assignmentData);
            
            // Check assignment results and provide appropriate feedback
            if (assignmentData && assignmentData.length > 0) {
              const result = assignmentData[0];
              console.log('Assignment result:', result);
              
              // Send worker assignment notifications for direct assignments
              if (result.assignment_status === 'direct_assigned' && result.assigned_worker_id) {
                console.log('Worker directly assigned, sending notifications');
                
                try {
                  // Send email notification
                  const { error: workerEmailError } = await supabase.functions.invoke('send-worker-assignment-notification', {
                    body: { 
                      bookingId,
                      workerId: result.assigned_worker_id 
                    }
                  });
                  
                  if (workerEmailError) {
                    console.error('Failed to send worker assignment email:', workerEmailError);
                    toast({
                      title: "Email Warning",
                      description: "Worker assigned but notification email failed. Check admin panel.",
                      variant: "destructive",
                    });
                  } else {
                    console.log('Worker assignment email sent successfully');
                  }

                  // Send SMS notification
                  const { error: workerSmsError } = await supabase.functions.invoke('send-sms-notification', {
                    body: { bookingId }
                  });
                  
                  if (workerSmsError) {
                    console.error('Failed to send worker assignment SMS:', workerSmsError);
                    toast({
                      title: "SMS Warning",
                      description: "Worker assigned but SMS notification failed. Worker will be contacted by email.",
                      variant: "destructive",
                    });
                  } else {
                    console.log('Worker assignment SMS sent successfully');
                  }
                } catch (notificationError) {
                  console.error('Worker notification error:', notificationError);
                  toast({
                    title: "Notification Warning",
                    description: "Worker assigned but notifications failed. Please check admin panel.",
                    variant: "destructive",
                  });
                }
                
                assignmentCompleted = true;
                toast({
                  title: "Worker Assigned",
                  description: "A worker has been assigned to your booking and notified.",
                });
              } else if (result.assignment_status === 'coverage_notifications_sent') {
                console.log('Coverage notifications sent to workers');
                assignmentCompleted = true;
                toast({
                  title: "Finding Worker",
                  description: `Notifications sent to ${result.notifications_sent || 'multiple'} workers. You'll be notified when someone accepts.`,
                });
              }
            }
          }
        } catch (assignmentError) {
          // Don't fail the booking confirmation for assignment errors
          toast({
            title: "Booking Confirmed",
            description: "Your payment was successful! We're working on assigning a worker to your booking.",
          });
          assignmentCompleted = true;
        }
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

      // Try to auto-assign workers
      try {
        const { data: assignments, error: assignmentError } = await supabase
          .rpc('auto_assign_workers_with_coverage', {
            p_booking_id: result.booking_id
          });

        if (assignmentError) {
          optimizedError('Worker assignment error:', assignmentError);
          return {
            booking_id: result.booking_id,
            assigned_workers: [],
            status: 'pending',
            message: 'Booking created! No workers currently available in your area, but we will assign one soon and contact you.'
          };
        }

        const assignedWorkers = assignments || [];
        const workerAssigned = assignedWorkers.length > 0 && assignedWorkers[0].assigned_worker_id;

        // Send worker assignment email if worker was directly assigned
        if (workerAssigned && assignedWorkers[0].assignment_status === 'direct_assigned') {
          // Email functionality removed - worker assigned without email notification
        }

        return {
          booking_id: result.booking_id,
          assigned_workers: assignedWorkers,
          status: workerAssigned ? 'confirmed' : 'pending',
          message: workerAssigned ? 
            `Booking confirmed! We've assigned a worker to your job and will contact you soon.` :
            'Booking created! No workers currently available in your area, but we will assign one soon and contact you.'
        };
      } catch (assignmentError) {
        optimizedError('Assignment process failed:', assignmentError);
        return {
          booking_id: result.booking_id,
          assigned_workers: [],
          status: 'pending',
          message: 'Booking created! Worker assignment will be done manually.'
        };
      }
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

  // No legacy wrapper methods needed - use createInitialBooking directly

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
    user,
    MINIMUM_BOOKING_AMOUNT,
    // New unified methods
    createUnauthenticatedBooking,
    createAdminBooking
  };
};
