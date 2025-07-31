import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useStripe, useElements, CardElement } from '@stripe/react-stripe-js';

// Types for the new payment-first flow
interface BookingPaymentData {
  amount: number;
  currency?: string;
  user_id?: string;
  guest_customer_info?: {
    name: string;
    email: string;
    phone?: string;
    address?: string;
    city?: string;
    zipcode?: string;
  };
}

interface BookingPayload {
  service_id: string;
  scheduled_date: string;
  scheduled_start: string;
  customer_id?: string;
  guest_customer_info?: Record<string, unknown>;
  location_notes?: string;
  [key: string]: unknown;
}

interface PaymentFlowResult {
  success: boolean;
  booking_id?: string;
  transaction_id?: string;
  payment_intent_id?: string;
  client_secret?: string;
  error?: string;
}

export const useBookingPaymentFlow = () => {
  const [processing, setProcessing] = useState(false);
  const { toast } = useToast();
  const stripe = useStripe();
  const elements = useElements();

  // Generate UUID for idempotency
  const generateIdempotencyKey = (): string => {
    return crypto.randomUUID();
  };

  /**
   * Step 1: Create payment intent (no booking created yet)
   */
  const createPaymentIntent = async (
    paymentData: BookingPaymentData
  ): Promise<{ success: boolean; client_secret?: string; transaction_id?: string; payment_intent_id?: string; error?: string }> => {
    try {
      console.log('🔄 Creating payment intent (payment-first approach)');
      
      const idempotencyKey = generateIdempotencyKey();
      
      const { data: result, error } = await supabase.functions.invoke('create-payment-intent', {
        body: {
          amount: paymentData.amount,
          currency: paymentData.currency || 'usd',
          idempotency_key: idempotencyKey,
          user_id: paymentData.user_id,
          guest_customer_info: paymentData.guest_customer_info,
        }
      });

      if (error) {
        console.error('❌ Payment intent creation failed:', error);
        throw new Error(error.message || 'Failed to create payment intent');
      }

      if (!result?.client_secret) {
        throw new Error('Invalid payment intent response - missing client secret');
      }

      console.log('✅ Payment intent created successfully');
      return {
        success: true,
        client_secret: result.client_secret,
        transaction_id: result.transaction_id,
        payment_intent_id: result.payment_intent_id,
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Payment intent creation failed';
      console.error('❌ Payment intent creation error:', error);
      
      return {
        success: false,
        error: errorMessage
      };
    }
  };

  /**
   * Step 2: Confirm payment with Stripe using card element
   */
  const confirmCardPayment = async (
    clientSecret: string
  ): Promise<{ success: boolean;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    paymentIntent?: any; error?: string }> => {
    try {
      if (!stripe || !elements) {
        throw new Error('Stripe not loaded');
      }

      const cardElement = elements.getElement(CardElement);
      if (!cardElement) {
        throw new Error('Card element not found');
      }

      console.log('🔄 Confirming card payment with Stripe');

      const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: cardElement,
        }
      });

      if (error) {
        console.error('❌ Card payment confirmation failed:', error);
        throw new Error(error.message || 'Payment confirmation failed');
      }

      if (!paymentIntent) {
        throw new Error('No payment intent returned from Stripe');
      }

      console.log('✅ Card payment confirmed', { status: paymentIntent.status });

      return {
        success: true,
        paymentIntent
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Payment confirmation failed';
      console.error('❌ Card payment confirmation error:', error);
      
      return {
        success: false,
        error: errorMessage
      };
    }
  };

  /**
   * Step 3: Create booking only after payment is authorized
   */
  const createBookingAfterPayment = async (
    paymentIntentId: string,
    bookingPayload: BookingPayload
  ): Promise<{ success: boolean; booking_id?: string; error?: string }> => {
    try {
      console.log('🔄 Creating booking after payment authorization');

      const { data: result, error } = await supabase.functions.invoke('create-booking', {
        body: {
          payment_intent_id: paymentIntentId,
          booking_payload: bookingPayload,
        }
      });

      if (error) {
        console.error('❌ Booking creation failed:', error);
        throw new Error(error.message || 'Failed to create booking');
      }

      if (!result?.booking_id) {
        throw new Error('Invalid booking creation response - missing booking_id');
      }

      console.log('✅ Booking created successfully');
      return {
        success: true,
        booking_id: result.booking_id,
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Booking creation failed';
      console.error('❌ Booking creation error:', error);
      
      return {
        success: false,
        error: errorMessage
      };
    }
  };

  /**
   * Complete payment-first booking flow
   * 1. Create payment intent (no booking)
   * 2. Confirm payment with Stripe
   * 3. Create booking only if payment authorized
   */
  const processPaymentFirstBooking = async (
    paymentData: BookingPaymentData,
    bookingPayload: BookingPayload
  ): Promise<PaymentFlowResult> => {
    setProcessing(true);
    
    try {
      console.log('🚀 Starting payment-first booking flow');

      // Step 1: Create payment intent
      const paymentIntentResult = await createPaymentIntent(paymentData);
      if (!paymentIntentResult.success) {
        throw new Error(paymentIntentResult.error || 'Failed to create payment intent');
      }

      const { client_secret, transaction_id, payment_intent_id } = paymentIntentResult;

      // Step 2: Confirm payment with card
      const confirmResult = await confirmCardPayment(client_secret!);
      if (!confirmResult.success) {
        throw new Error(confirmResult.error || 'Payment confirmation failed');
      }

      const { paymentIntent } = confirmResult;

      // Step 3: Check if payment is authorized (requires_capture)
      if (paymentIntent.status !== 'requires_capture') {
        throw new Error(`Payment not authorized. Status: ${paymentIntent.status}`);
      }

      console.log('✅ Payment authorized');

      // Update transaction status using edge function
      try {
        const { data: updateResult, error: updateError } = await supabase.functions.invoke('update-transaction-status', {
          body: { payment_intent_id, status: 'authorized' }
        });

        if (updateError || !updateResult?.success) {
          throw new Error(updateError?.message || updateResult?.error || 'Failed to update transaction status');
        }
      } catch (updateErr: unknown) {
        const errorMessage = updateErr instanceof Error ? updateErr.message : 'Failed to update transaction status';
        console.error('❌ update-transaction-status error:', updateErr);
        toast({
          title: 'Payment Authorized But Failed',
          description: errorMessage,
          variant: 'destructive'
        });
        return { success: false, error: errorMessage };
      }

      console.log('🔄 Creating booking record');

      // Step 4: Create booking after successful authorization
      const bookingResult = await createBookingAfterPayment(payment_intent_id!, bookingPayload);
      if (!bookingResult.success) {
        throw new Error(bookingResult.error || 'Failed to create booking');
      }

      toast({
        title: "Booking Created Successfully",
        description: "Your payment has been authorized and booking confirmed",
      });

      console.log('🎉 Payment-first booking flow completed successfully');

      return {
        success: true,
        booking_id: bookingResult.booking_id,
        transaction_id,
        payment_intent_id,
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Booking process failed';
      console.error('❌ Payment-first booking flow failed:', error);
      
      toast({
        title: "Booking Failed",
        description: errorMessage,
        variant: "destructive",
      });

      return {
        success: false,
        error: errorMessage
      };
    } finally {
      setProcessing(false);
    }
  };

  // Legacy methods for backward compatibility (will be deprecated)
  const createBookingWithPayment = async (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    bookingData: any,
    amount: number,
    currency: string = 'usd'
  ): Promise<PaymentFlowResult> => {
    console.warn('⚠️ createBookingWithPayment is deprecated. Use processPaymentFirstBooking instead.');
    
    // Convert legacy format to new format
    const paymentData: BookingPaymentData = {
      amount,
      currency,
      user_id: bookingData.customer_id,
    };

    const bookingPayload: BookingPayload = {
      service_id: bookingData.service_id,
      scheduled_date: bookingData.scheduled_date,
      scheduled_start: bookingData.scheduled_start,
      customer_id: bookingData.customer_id,
      location_notes: bookingData.location_notes,
    };

    return processPaymentFirstBooking(paymentData, bookingPayload);
  };

  const confirmPayment = async (
    payment_intent_id: string,
    booking_id: string
  ): Promise<PaymentFlowResult> => {
    console.warn('⚠️ confirmPayment is deprecated in payment-first flow.');
    return {
      success: false,
      error: 'Method not supported in payment-first flow'
    };
  };

  const cancelBookingPayment = async (
    booking_id: string,
    payment_intent_id?: string,
    reason: string = 'user_cancelled'
  ): Promise<PaymentFlowResult> => {
    console.warn('⚠️ cancelBookingPayment will be updated for payment-first flow.');
    return {
      success: false,
      error: 'Method not supported in payment-first flow'
    };
  };

  return {
    // New payment-first methods (recommended)
    processPaymentFirstBooking,
    createPaymentIntent,
    confirmCardPayment,
    createBookingAfterPayment,
    generateIdempotencyKey,
    
    // Legacy methods (deprecated)
    createBookingWithPayment,
    confirmPayment,
    cancelBookingPayment,
    
    // State
    processing,
    loading: processing, // Alias for backward compatibility
  };
};