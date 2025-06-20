
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface StripePaymentData {
  bookingId: string;
  amount: number;
  description: string;
  customerEmail?: string;
}

export const useStripePayment = () => {
  const [processing, setProcessing] = useState(false);
  const { toast } = useToast();

  const createPaymentLink = async (paymentData: StripePaymentData) => {
    setProcessing(true);
    
    try {
      console.log('Creating Stripe payment link:', paymentData);

      const { data, error } = await supabase.functions.invoke('create-payment-link', {
        body: {
          bookingId: paymentData.bookingId,
          amount: Math.round(paymentData.amount * 100), // Convert to cents
          description: paymentData.description,
          customerEmail: paymentData.customerEmail
        }
      });

      if (error) {
        console.error('Payment link creation error:', error);
        throw new Error(error.message || 'Failed to create payment link');
      }

      if (!data?.url) {
        throw new Error('No payment URL received');
      }

      console.log('Payment link created successfully:', data.url);
      
      toast({
        title: "Payment Link Created",
        description: "Payment link has been generated successfully",
      });

      return {
        success: true,
        paymentUrl: data.url
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create payment link';
      console.error('Payment link creation failed:', error);
      
      toast({
        title: "Payment Error",
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

  const processDirectPayment = async (paymentData: StripePaymentData & { paymentMethodId: string }) => {
    setProcessing(true);
    
    try {
      console.log('Processing direct Stripe payment:', paymentData);

      const { data, error } = await supabase.functions.invoke('process-payment', {
        body: {
          bookingId: paymentData.bookingId,
          customerId: paymentData.customerEmail,
          paymentMethodId: paymentData.paymentMethodId,
          amount: paymentData.amount
        }
      });

      if (error) {
        console.error('Direct payment processing error:', error);
        throw new Error(error.message || 'Payment processing failed');
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Payment processing failed');
      }

      console.log('Payment processed successfully:', data);
      
      toast({
        title: "Payment Successful",
        description: "Payment has been processed successfully",
      });

      return {
        success: true,
        transactionId: data.transaction_id
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Payment processing failed';
      console.error('Direct payment processing failed:', error);
      
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

  return {
    createPaymentLink,
    processDirectPayment,
    processing
  };
};
