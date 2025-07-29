import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { loadStripe } from '@stripe/stripe-js';

interface StripePaymentData {
  bookingId: string;
  amount: number;
  description: string;
  customerEmail?: string;
}

export const useStripePayment = () => {
  const [processing, setProcessing] = useState(false);
  const { toast } = useToast();

  // Initialize Stripe
  const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || 'pk_live_51QZXYeD5eDOPKYNxVKWjPfmKYtE4yzYi9yKTK7Ur4vrlEOMrGJAR9LoKWqh8nAYHUUWLZZgxJGQq7qCTI9eOHIHx00XgkP7j0Z');

  const createPaymentLink = async (paymentData: StripePaymentData): Promise<{
    success: boolean;
    paymentUrl?: string;
    error?: string;
  }> => {
    setProcessing(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('create-payment-link', {
        body: {
          booking_id: paymentData.bookingId,
          amount: paymentData.amount,
          description: paymentData.description,
          customer_email: paymentData.customerEmail
        }
      });

      if (error) {
        throw new Error(error.message);
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Failed to create payment link');
      }

      toast({
        title: "Payment Link Created",
        description: "Customer payment link has been generated",
      });

      return {
        success: true,
        paymentUrl: data.payment_url
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create payment link';
      console.error('Payment link creation failed:', error);
      
      toast({
        title: "Payment Link Failed",
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

  const createPaymentIntent = async (paymentData: {
    amount: number;
    customerEmail: string;
    customerName: string;
    bookingId?: string;
    captureMethod?: 'automatic' | 'manual';
  }) => {
    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-payment-intent', {
        body: {
          ...paymentData,
          captureMethod: paymentData.captureMethod || 'manual'
        }
      });

      if (error) throw error;
      
      return data;
    } catch (error) {
      console.error('Error creating payment intent:', error);
      throw error;
    } finally {
      setProcessing(false);
    }
  };

  const confirmCardPayment = async (clientSecret: string, paymentMethodData?: any) => {
    const stripe = await stripePromise;
    if (!stripe) {
      throw new Error('Stripe not initialized');
    }

    setProcessing(true);
    try {
      const confirmData: any = {
        payment_method: paymentMethodData || {
          type: 'card',
          card: {
            number: '4242424242424242',
            exp_month: 12,
            exp_year: 2025,
            cvc: '123'
          }
        }
      };

      const result = await stripe.confirmCardPayment(clientSecret, confirmData);
      
      if (result.error) {
        throw new Error(result.error.message);
      }

      return result;
    } catch (error) {
      console.error('Error confirming card payment:', error);
      throw error;
    } finally {
      setProcessing(false);
    }
  };

  return {
    createPaymentLink,
    createPaymentIntent,
    confirmCardPayment,
    processing
  };
};