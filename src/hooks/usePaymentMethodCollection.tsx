
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface PaymentMethodData {
  bookingId: string;
  customerEmail: string;
  customerName: string;
}

export const usePaymentMethodCollection = () => {
  const [processing, setProcessing] = useState(false);
  const { toast } = useToast();

  const savePaymentMethod = async (
    paymentMethodData: PaymentMethodData,
    stripe: any,
    cardElement: any
  ) => {
    setProcessing(true);
    
    try {
      console.log('Creating payment method for future use:', paymentMethodData);

      // Create payment method with Stripe
      const { error: pmError, paymentMethod } = await stripe.createPaymentMethod({
        type: 'card',
        card: cardElement,
        billing_details: {
          name: paymentMethodData.customerName,
          email: paymentMethodData.customerEmail,
        },
      });

      if (pmError) {
        throw new Error(pmError.message);
      }

      // Create or get Stripe customer and attach payment method
      const { data, error } = await supabase.functions.invoke('setup-customer-payment', {
        body: {
          bookingId: paymentMethodData.bookingId,
          customerEmail: paymentMethodData.customerEmail,
          customerName: paymentMethodData.customerName,
          paymentMethodId: paymentMethod.id
        }
      });

      if (error) {
        console.error('Payment method setup error:', error);
        throw new Error(error.message || 'Failed to save payment method');
      }

      console.log('Payment method saved successfully:', data);
      
      toast({
        title: "Payment Method Saved",
        description: "Your credit card has been securely saved for manual charging by the technician.",
      });

      return {
        success: true,
        customerId: data.customer_id,
        paymentMethodId: data.payment_method_id
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save payment method';
      console.error('Payment method collection failed:', error);
      
      toast({
        title: "Payment Setup Failed",
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
    savePaymentMethod,
    processing
  };
};
