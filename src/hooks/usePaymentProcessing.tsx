
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface PaymentResult {
  success: boolean;
  error?: string;
  transactionId?: string;
}

interface OnlinePaymentData {
  bookingId: string;
  customerId: string;
  amount: number;
  description?: string;
  paymentMethodId?: string;
}

interface CreateCheckoutData {
  bookingData: any;
  customerEmail: string;
  customerName: string;
}

export const usePaymentProcessing = () => {
  const [processing, setProcessing] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const { toast } = useToast();

  const processOnlinePayment = async (paymentData: OnlinePaymentData): Promise<PaymentResult> => {
    setProcessing(true);
    
    try {
      console.log('Processing online payment:', paymentData);

      const { data, error } = await supabase.functions.invoke('process-payment', {
        body: {
          bookingId: paymentData.bookingId,
          customerId: paymentData.customerId,
          paymentMethodId: paymentData.paymentMethodId
        }
      });

      if (error) {
        console.error('Payment processing error:', error);
        
        // Handle specific Stripe errors
        if (error.message?.includes('card_declined')) {
          throw new Error('Your card was declined. Please try a different payment method.');
        }
        
        if (error.message?.includes('insufficient_funds')) {
          throw new Error('Insufficient funds. Please check your account balance.');
        }
        
        if (error.message?.includes('expired_card')) {
          throw new Error('Your card has expired. Please update your payment method.');
        }
        
        if (error.message?.includes('authentication_required')) {
          throw new Error('Additional authentication required. Please contact your bank.');
        }
        
        throw new Error(error.message || 'Payment processing failed');
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Payment processing failed');
      }

      console.log('Payment processed successfully:', data);
      
      toast({
        title: "Payment Successful",
        description: "Your payment has been processed successfully",
      });

      return {
        success: true,
        transactionId: data.transaction_id
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Payment processing failed';
      console.error('Payment processing failed:', error);
      
      toast({
        title: "Payment Failed",
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

  const createCheckoutSession = async (checkoutData: CreateCheckoutData): Promise<PaymentResult> => {
    setProcessing(true);
    
    try {
      console.log('Creating checkout session:', checkoutData);

      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: checkoutData
      });

      if (error) {
        console.error('Checkout session creation error:', error);
        throw new Error(error.message || 'Failed to create checkout session');
      }

      if (!data?.url) {
        throw new Error('No checkout URL received');
      }

      console.log('Checkout session created successfully');
      
      // Open checkout in new window
      const checkoutWindow = window.open(data.url, '_blank', 'width=800,height=600');
      
      if (!checkoutWindow) {
        throw new Error('Unable to open checkout window. Please disable popup blockers and try again.');
      }

      return {
        success: true
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create checkout session';
      console.error('Checkout session creation failed:', error);
      
      toast({
        title: "Checkout Error",
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

  const retryPayment = async (paymentFunction: () => Promise<PaymentResult>): Promise<PaymentResult> => {
    const maxRetries = 3;
    
    if (retryCount >= maxRetries) {
      return {
        success: false,
        error: 'Maximum retry attempts reached. Please try again later.'
      };
    }

    setRetryCount(prev => prev + 1);
    
    try {
      const result = await paymentFunction();
      if (result.success) {
        setRetryCount(0); // Reset on success
      }
      return result;
    } catch (error) {
      console.error(`Payment retry ${retryCount + 1} failed:`, error);
      return {
        success: false,
        error: 'Payment retry failed'
      };
    }
  };

  const verifyPayment = async (sessionId: string): Promise<PaymentResult> => {
    try {
      console.log('Verifying payment for session:', sessionId);

      const { data, error } = await supabase.functions.invoke('verify-payment', {
        body: { session_id: sessionId }
      });

      if (error) {
        console.error('Payment verification error:', error);
        throw new Error(error.message || 'Payment verification failed');
      }

      return {
        success: data?.success || false,
        error: data?.success ? undefined : 'Payment verification failed'
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Payment verification failed';
      console.error('Payment verification failed:', error);
      
      return {
        success: false,
        error: errorMessage
      };
    }
  };

  return {
    processOnlinePayment,
    createCheckoutSession,
    retryPayment,
    verifyPayment,
    processing,
    retryCount
  };
};
