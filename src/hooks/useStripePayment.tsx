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

  return {
    createPaymentLink,
    processing
  };
};