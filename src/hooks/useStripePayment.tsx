import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { loadStripe } from '@stripe/stripe-js';
import { optimizedLog, optimizedError, measurePerformance } from '@/utils/performanceOptimizer';

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
  const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || 'pk_live_51RYKUCCrUPkotWKCM10E0EeqJ5j24WbloBt4CemrXYkJxsGUdS6Xxl5hsyh7UaIHBeI9nVtgqjmXI3sTD7xyvNnV00s1GO6it4');

  const createCheckoutSession = async (paymentData: StripePaymentData): Promise<{
    success: boolean;
    checkoutUrl?: string;
    sessionId?: string;
    error?: string;
  }> => {
    setProcessing(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout-session', {
        body: {
          booking_id: paymentData.bookingId,
          amount: paymentData.amount,
          customer_name: paymentData.description.split(' - ')[0] || 'Customer',
          customer_email: paymentData.customerEmail
        }
      });

      if (error) {
        throw new Error(error.message);
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Failed to create checkout session');
      }

      return {
        success: true,
        checkoutUrl: data.checkout_url,
        sessionId: data.session_id
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create checkout session';
      console.error('Checkout session creation failed:', error);
      
      toast({
        title: "Checkout Failed",
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

  const verifyCheckoutSession = async (sessionId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('verify-checkout-session', {
        body: { session_id: sessionId }
      });

      if (error) {
        throw new Error(error.message);
      }

      return data;
    } catch (error) {
      console.error('Session verification failed:', error);
      throw error;
    }
  };

  return {
    createCheckoutSession,
    verifyCheckoutSession,
    confirmCardPayment,
    processing
  };
};